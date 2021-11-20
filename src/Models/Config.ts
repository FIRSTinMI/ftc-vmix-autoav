
export interface AutoAVConfig {
  ftc_ip: string | null;
  ftc_api_key: string | null;
  ftc_port: string | null;
  av_ip: string | null;
  ftc_event_code: string | null;
  vmix_input_names: string[];
  api_authed: boolean;
}
