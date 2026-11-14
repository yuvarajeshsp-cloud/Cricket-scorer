export type Extra = "wd" | "nb" | "b" | "lb"

export type DismissalKind = "bowled" | "caught" | "lbw" | "run-out" | "stumped" | "hit-wicket"

/** Someone who has played in any match on this phone. Stats are worked out from the matches. */
export interface Player {
  id: string
  name: string
  createdAt: string
  /** One-tap placeholder ("Batter 3"): kept out of the Players list and never reused. */
  guest?: boolean
  /** Last change, for syncing a signed-in scorer's phones (newest wins). */
  updatedAt?: string
}

/** One thing that happened in an innings. The scorecard is always rebuilt from this list, so undo is just "drop the last event". */
export type InningsEvent =
  | {
      type: "ball"
      /** Runs off the bat (or runs completed for byes, leg byes and wides). */
      runs: number
      extra?: Extra
      /** fielder is a player id. */
      wicket?: { kind: DismissalKind; out: "striker" | "non-striker"; fielder?: string }
    }
  /** id is a player id. */
  | { type: "bowler"; id: string }
  | { type: "batter"; id: string }
  /** Scorer fixes who is on strike. */
  | { type: "swap" }
  /**
   * Batter leaves the crease without a ball being bowled. "not-out" is not a
   * wicket and they can bat again later in the innings; "out" counts as a wicket.
   */
  | { type: "retire"; who: "striker" | "non-striker"; kind: "not-out" | "out" }

export interface Innings {
  batting: string
  bowling: string
  events: InningsEvent[]
}

export interface MatchSetup {
  teamA: string
  teamB: string
  overs: number
  playersPerSide: number
  tossWinner: string
  tossChoice: "bat" | "bowl"
  /** Team name → player ids. */
  squads: Record<string, string[]>
}

export interface Match extends MatchSetup {
  id: string
  createdAt: string
  /** Player id → name as it was in this match, so the scorecard never depends on the player list. */
  roster: Record<string, string>
  innings: Innings[]
  /** Proves this phone is the scorer when publishing. Never sent to viewers (synced only to the scorer's own account). */
  secret?: string
  /** Last change, for syncing a signed-in scorer's phones (newest wins). */
  updatedAt?: string
}
