interface ActiveMatchesResp {
  matches: FTCMatch[]
}

interface FTCMatch {
  "matchName": string,
  "matchNumber": number,
  "field": number,
  "red": FTCAlliance,
  "blue": FTCAlliance,
  "finished": boolean,
  "matchState": "UNPLAYED" | "PLAYED",
  "time": number
}

interface FTCAlliance {
  team1: number,
  team2: number,
  isTeam1Surrogate: boolean,
  isTeam2Surrogate: boolean
}

export {
  ActiveMatchesResp, FTCAlliance, FTCMatch
}
