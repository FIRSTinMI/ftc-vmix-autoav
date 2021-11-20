import got from 'got';
import {ActiveMatchesResp} from "./Models/FTC";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {AutoAVConfig} from "./Models/Config";
import {get as getPrompt, Schema} from "prompt"

let config = {} as AutoAVConfig;

setup().then(() => {
  start()
});

async function start() {
  console.log('Starting...')
  let lastField = -1;
  while(true){
    try{
      const header = {} as any;
      if(config.api_authed) header.authorization = config.ftc_api_key;
      const resp = await got<ActiveMatchesResp>( `${FTC_API()}/events/${config.ftc_event_code}/matches/active/`, {
        method: "GET",
        retry: {
          limit: 0
        },
        headers: header,
        responseType: "json"
      });
      if(resp.statusCode === 429) {
        console.warn('I broke myself... I have made too many requests!');
      } else if(resp.body.matches && resp.body.matches.length > 0) {
        // Sort by match number
        resp.body.matches.sort((a, b) => a.matchNumber - b.matchNumber);
        // Remove played matches
        resp.body.matches.filter((m) => !m.finished);
        // First match is soonest match
        const currentMatch = resp.body.matches[0];
        // If field is not the same as the last set field
        if(currentMatch.field !== lastField) {
          console.log(`Now on field ${currentMatch.field}`)
          dispatchVmix(currentMatch.field);
          lastField = currentMatch.field;
        }
      }
    } catch(err: any) {
      console.warn('There has been an error 👀', err.message);
    }
    await sleep (10500);
  }
}

async function setup() {
  return new Promise<void>(async (resolve) => {
    try {
      // Load config
      const file = fs.readFileSync(path.join(os.homedir(), 'autoav_ftc_conf.json'), {encoding: 'utf-8'});
      config = JSON.parse(file);
    } catch (err) {
      // Probably no file
      console.log('No config file fount... Starting from scratch!');
    }
    if(config.ftc_ip) {
      const input = await prompt(`Scorekeeper IP is '${config.ftc_ip}' (Y/n)`, false);
      if(input && input.toLowerCase() !== 'y') config.ftc_ip = null;
    }
    if(!config.ftc_ip) {
      config.ftc_ip = await prompt(`Please enter scorekeeper IP (without the port!)`);
    }
    if(config.ftc_port) {
      const input = await prompt(`Scorekeeper Port is '${config.ftc_port}' (Y/n)`, false);
      if(input && input.toLowerCase() !== 'y') config.ftc_port = null;
    }
    if(!config.ftc_port) {
      config.ftc_port = await prompt(`Please enter scorekeeper port`);
    }
    if(config.ftc_api_key) {
      console.log('Scorekeeper API key found in config. Validating...');
      try {
        const resp = await got<{active: boolean}>( `${FTC_API()}/keycheck/`, {
          method: "GET",
          headers: {authorization: config.ftc_api_key},
          retry: {
            limit: 0
          },
          responseType: "json"
        });
        if (resp.body.active) {
          console.log('API Key is found and is active!')
        } else {
          console.log(`API Key is found, but has not been approved. Please approve API key "${config.ftc_api_key}" in the Scorekeeper app!`)
          const longPull = await got<{active: boolean}>( `${FTC_API()}/keywait/`, {
            method: "GET",
            headers: {authorization: config.ftc_api_key},
            retry: {
              limit: 0
            },
            responseType: "json"
          });
          if(longPull.body.active) {
            config.api_authed = true;
            console.log('API Key Approved');
          } else {
            console.warn('API Key Auth denied :(. This may cause problems with polling!');
          }
        }
      } catch {
        console.warn('API Key invalid, or error fetching key. Requesting new key!');
      }
    }
    if(config.ftc_event_code) {
      const input = await prompt(`FTC Event code is '${config.ftc_event_code}' (Y/n)`, false);
      if(input && input.toLowerCase() !== 'y') config.ftc_event_code = null;
    }
    if(!config.ftc_event_code) {
      // TODO: query avaliable ftc events and make list
      config.ftc_event_code = await prompt(`Please enter FTC event code: `);
    }
    if(!config.ftc_api_key) {
      config.ftc_api_key = await blockingApiKeyReq();
    }
    if(config.av_ip) {
      const input = await prompt(`VMix IP is '${config.av_ip}' (Y/n)`, false);
      if(input && input.toLowerCase() !== 'y') config.av_ip = null;
    }
    if(!config.av_ip) {
      config.av_ip = await prompt(`Please enter AV IP`);
    }
    if(config.vmix_input_names && Array.isArray(config.vmix_input_names)) {
      const input = await prompt(`Vmix Field input numbers are '${printPrettyFieldToInput()}' (Y/n)`, false);
      if(input && input.toLowerCase() !== 'y') config.vmix_input_names = [];
    }
    if(!config.vmix_input_names || (config.vmix_input_names && !Array.isArray(config.vmix_input_names)) || (config.vmix_input_names && config.vmix_input_names.length < 1)) {
      let fieldCount = 1;
      config.vmix_input_names = [];
      while(true) {
        const input = await prompt(`Please enter Vmix input number for field ${fieldCount} (leave blank if you're done)`, fieldCount === 1);
        if(input.length < 1) break;
        config.vmix_input_names.push(input?? '');
        fieldCount++;
      }
    }
    console.log('Configuration complete. Writing to file...');
    try {
      fs.writeFileSync(path.join(os.homedir(), 'autoav_ftc_conf.json'), JSON.stringify(config), {encoding: "utf-8"});
    } catch(err: any) {
      console.log('Error writing file:', err.msg)
    }
    console.log("Saved!")
    resolve();
  })
}

async function blockingApiKeyReq(): Promise<string | null> {
  return new Promise<string | null>(async (resolve) => {
    try{
      const resp = await got<{name: string, key: string, startTime: number}>( `${FTC_API()}/keyrequest/?name=ftc_vmix_app`, {
        method: "POST",
        retry: {
          limit: 0
        },
        responseType: "json"
      });
      console.log(`API Key Requested, please authorize "ftc_vmix_app" in the FTC Scorekeeper! (API Key ${resp.body.key})`);
      const apiKey = resp.body.key;
      const longPull = await got<{active: boolean}>( `${FTC_API()}/keywait/`, {
        method: "GET",
        headers: {authorization: apiKey},
        retry: {
          limit: 0
        },
        responseType: "json"
      });
      if(longPull.body.active) {
        config.api_authed = true;
        console.log('API Key Approved!')
        resolve(apiKey);
      } else {
        console.warn('API Key Auth denied :(. This may cause problems with polling!')
      }
    } catch(err) {
      console.warn('Error in API Key authentication flow:', err);
      resolve(null);
    }
  })
}

async function dispatchVmix(field: number) {
  const user = 'admin';
  const pass = 'admin';
  const auth = Buffer.from(`${user}:${pass}`).toString('base64');
  try {
    const input = encodeURIComponent(config.vmix_input_names[field - 1]);
    const resp = await got( `http://${config.av_ip}:8088/api/?Function=QuickPlay&Input=${input}`, {
      method: "GET",
      headers: {authorization: `Basic ${auth}`},
      retry: {
        limit: 0
      },
    });
    if(resp.body !== "Function completed successfully.") console.warn('Failed to execute function in Vmix!')
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
    getPrompt<{prop: any}>([schema], (err, result) => {
      resolve(result.prop);
    })
  })
}

function printPrettyFieldToInput(): string {
  let returnVal = '';
  for(let i = 0; i < config.vmix_input_names.length; i++) {
    if(i === config.vmix_input_names.length - 1) returnVal += `Field ${i + 1} => Input #${config.vmix_input_names[i]}`
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
