import got from 'got';
import WebSocket from 'ws';
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { AutoAVConfig } from "./Models/Config";
import { get as getPrompt, Schema } from "prompt"

let config = {} as AutoAVConfig;

setup().then(() => {
    start()
});

type Message = {
    type: string;
    ts: number;
    params: {
        field: number
    }
};

async function start() {
    console.log('Starting...')
    let lastField = -1;
    const ws = new WebSocket(`ws://${config.ftc_ip}:${config.ftc_port}/stream/display/command/?code=${config.ftc_event_code}`);
    let messageQueue: Message[] = [];
    let processing = false;

    ws.on('error', console.error);

    ws.on('message', async (data: string) => {
        if (data == 'pong') return;

        let json = JSON.parse(data) as Message;

        if (['SHOW_PREVIEW', 'SHOW_MATCH'].includes(json.type)) {
            messageQueue.push(json);

            if (!processing) {
                await processMessagesWhenIdle();
            }
        }
    });

    const vmixTransitionTime = 1500;
    let lastChange = +new Date() - vmixTransitionTime;
    let lastMessage = {
        ts: 0,
        params: {
            field: lastField
        }
    }

    async function processMessagesWhenIdle() {
        processing = true;

        setTimeout(async () => {
            const now = +new Date();
            if (messageQueue.length === 0 && now - lastChange > vmixTransitionTime) {
                lastChange = +new Date();
                processing = false; // Avoid race condition if a message comes in while changing fields
                return await changeField(lastMessage);
            }
            while (messageQueue.length > 0) {
                const json = messageQueue.shift()!;
                if (json.ts > lastMessage.ts) {
                    lastMessage = json;
                }
            }
            await processMessagesWhenIdle();
        }, 50); // Wait 50ms for additional messages to come in
    }

    async function changeField(message: any) {
        if (message.params.field == lastField) return;

        console.log(`Now on field ${message.params.field}`);
        await dispatchVmix(message.params.field);

        lastField = message.params.field;
        lastChange = +new Date();
        processing = false;
    }
}

async function setup() {
    return new Promise<void>(async (resolve) => {
        try {
            // Load config
            const file = fs.readFileSync(path.join(os.homedir(), 'autoav_ftc_conf.json'), { encoding: 'utf-8' });
            config = JSON.parse(file);
        } catch (err) {
            // Probably no file
            console.log('No config file found... Starting from scratch!');
        }
        if (config.ftc_ip) {
            const input = await prompt(`Scorekeeper IP is '${config.ftc_ip}' (Y/n)`, false);
            if (input && input.toLowerCase() !== 'y') config.ftc_ip = null;
        }
        if (!config.ftc_ip) {
            config.ftc_ip = await prompt(`Please enter scorekeeper IP (without the port!)`);
        }
        if (config.ftc_port) {
            const input = await prompt(`Scorekeeper Port is '${config.ftc_port}' (Y/n)`, false);
            if (input && input.toLowerCase() !== 'y') config.ftc_port = null;
        }
        if (!config.ftc_port) {
            config.ftc_port = await prompt(`Please enter scorekeeper port`);
        }
        if (config.ftc_event_code) {
            const input = await prompt(`FTC Event code is '${config.ftc_event_code}' (Y/n)`, false);
            if (input && input.toLowerCase() !== 'y') config.ftc_event_code = null;
        }
        if (!config.ftc_event_code) {
            // TODO: query avaliable ftc events and make list
            config.ftc_event_code = await prompt(`Please enter FTC event code: `);
        }
        if (config.av_ip) {
            const input = await prompt(`VMix IP is '${config.av_ip}' (Y/n)`, false);
            if (input && input.toLowerCase() !== 'y') config.av_ip = null;
        }
        if (!config.av_ip) {
            config.av_ip = await prompt(`Please enter AV IP`);
        }
        if (config.vmix_input_names && Array.isArray(config.vmix_input_names)) {
            const input = await prompt(`Vmix Field input numbers are '${printPrettyFieldToInput()}' (Y/n)`, false);
            if (input && input.toLowerCase() !== 'y') config.vmix_input_names = [];
        }
        if (!config.vmix_input_names || (config.vmix_input_names && !Array.isArray(config.vmix_input_names)) || (config.vmix_input_names && config.vmix_input_names.length < 1)) {
            let fieldCount = 1;
            config.vmix_input_names = [];
            while (true) {
                const input = await prompt(`Please enter Vmix input number for field ${fieldCount} (leave blank if you're done)`, fieldCount === 1);
                if (input.length < 1) break;
                config.vmix_input_names.push(input ?? '');
                fieldCount++;
            }
        }
        console.log('Configuration complete. Writing to file...');
        try {
            fs.writeFileSync(path.join(os.homedir(), 'autoav_ftc_conf.json'), JSON.stringify(config), { encoding: "utf-8" });
        } catch (err: any) {
            console.log('Error writing file:', err.msg)
        }
        console.log("Saved!")
        resolve();
    })
}

async function dispatchVmix(field: number) {
    const user = 'admin';
    const pass = 'admin';
    const auth = Buffer.from(`${user}:${pass}`).toString('base64');
    try {
        const input = encodeURIComponent(config.vmix_input_names[field - 1]);
        const resp = await got(`http://${config.av_ip}:8088/api/?Function=QuickPlay&Input=${input}`, {
            method: "GET",
            headers: { authorization: `Basic ${auth}` },
            retry: {
                limit: 0
            },
        });
        if (resp.body !== "Function completed successfully.") console.warn('Failed to execute function in Vmix!')
    } catch (err: any) {
        console.warn('Error updating vmix:', err.message)
    }
}

async function prompt(message: string, required: boolean = true): Promise<string> {
    return new Promise<string>(resolve => {
        const schema = {
            properties: {
                prop: {
                    // pattern: /^[a-zA-Z\s\-]+$/,
                    message: message,
                    required: required
                }
            }
        } as Schema;
        getPrompt<{ prop: any }>([schema], (err, result) => {
            resolve(result.prop);
        })
    })
}

function printPrettyFieldToInput(): string {
    let returnVal = '';
    for (let i = 0; i < config.vmix_input_names.length; i++) {
        if (i === config.vmix_input_names.length - 1) returnVal += `Field ${i + 1} => Input #${config.vmix_input_names[i]}`
        else returnVal += `Field ${i + 1} => Input #${config.vmix_input_names[i]}, `
    }
    return returnVal;
}

const FTC_API = () => {
    return `http://${config.ftc_ip}:${config.ftc_port}/api/v1`
}

function sleep(delay: number) {
    return new Promise(resolve => {
        setTimeout(resolve, delay);
    })
}
