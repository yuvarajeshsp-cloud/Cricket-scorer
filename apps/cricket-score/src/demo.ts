import type { InningsEvent, Match, Player } from "./engine/types"
import { newId } from "./store"
import { newSecret } from "./live"

/** Example players and two example matches (one finished, one mid-chase), clearly named as a demo. */
export function demoData(): { players: Player[]; matches: Match[] } {
  const names = {
    rs: ["Arun", "Karthik", "Dinesh", "Hari", "Prakash", "Senthil", "Gopi", "Naveen", "Ajay", "Sanjay", "Ram"],
    cl: ["Ravi", "Bala", "Mani", "Vijay", "Suresh", "Kumar", "Siva", "Ganesh", "Raju", "Deepak", "Anand"],
  }
  const now = Date.now()
  const players: Player[] = [...names.rs, ...names.cl].map((n) => ({ id: newId(), name: n, createdAt: new Date(now - 864e5 * 3).toISOString() }))
  const id = (n: string) => players.find((p) => p.name === n)!.id
  const roster = Object.fromEntries(players.map((p) => [p.id, p.name]))
  const squads = { "Royal Strikers": names.rs.map(id), "Chennai Lions": names.cl.map(id) }

  const b = (runs: number, extra?: "wd" | "nb" | "b" | "lb"): InningsEvent => ({ type: "ball", runs, extra })
  const out = (kind: "bowled" | "caught" | "lbw" | "run-out", fielder?: string): InningsEvent => ({
    type: "ball",
    runs: 0,
    wicket: { kind, out: "striker", fielder: fielder ? id(fielder) : undefined },
  })
  const bat = (n: string): InningsEvent => ({ type: "batter", id: id(n) })
  const bowl = (n: string): InningsEvent => ({ type: "bowler", id: id(n) })

  const base = { teamA: "Royal Strikers", teamB: "Chennai Lions", overs: 5, playersPerSide: 11, roster, squads }

  // Yesterday: finished.
  const done: Match = {
    ...base,
    id: newId(),
    secret: newSecret(),
    createdAt: new Date(now - 864e5).toISOString(),
    tossWinner: "Royal Strikers",
    tossChoice: "bowl",
    innings: [
      {
        batting: "Chennai Lions",
        bowling: "Royal Strikers",
        events: [
          bat("Ravi"), bat("Bala"), bowl("Prakash"),
          b(1), b(0), b(4), b(1), b(0), out("caught", "Arun"),
          bat("Mani"), bowl("Senthil"),
          b(2), b(1), b(6), b(0), b(0, "wd"), b(1), b(4),
          bowl("Prakash"),
          b(0), out("bowled"), bat("Vijay"), b(1), b(1), b(4), b(0),
          bowl("Senthil"),
          b(6), b(1), b(0), b(2), b(1), b(1),
          bowl("Gopi"),
          b(4), b(0), out("caught", "Karthik"), bat("Suresh"), b(1), b(2), b(1),
        ],
      },
      {
        batting: "Royal Strikers",
        bowling: "Chennai Lions",
        events: [
          bat("Arun"), bat("Karthik"), bowl("Vijay"),
          b(4), b(1), b(0), b(6), b(1), b(1),
          bowl("Suresh"),
          b(0), b(4), b(2), out("lbw"), bat("Dinesh"), b(1), b(6),
          bowl("Vijay"),
          b(1), b(4), b(0, "nb"), b(4), b(1), b(1), b(2),
          bowl("Mani"),
          b(1), b(6),
        ],
      },
    ],
  }

  // Today: mid-chase.
  const live: Match = {
    ...base,
    id: newId(),
    secret: newSecret(),
    createdAt: new Date(now).toISOString(),
    tossWinner: "Chennai Lions",
    tossChoice: "bowl",
    innings: [
      {
        batting: "Royal Strikers",
        bowling: "Chennai Lions",
        events: [
          bat("Arun"), bat("Karthik"), bowl("Vijay"),
          b(1), b(4), b(0), b(0, "wd"), b(2), b(6), b(1),
          bowl("Suresh"),
          b(0), out("caught", "Mani"), bat("Dinesh"), b(4), b(1), b(1, "lb"), b(0),
          bowl("Vijay"),
          b(6), b(2), b(1), b(0, "nb"), b(4), b(1), b(0),
          bowl("Suresh"),
          b(1), b(1), out("bowled"), bat("Hari"), b(2), b(4), b(0),
          bowl("Mani"),
          b(1), b(6), b(0), b(1), b(2), b(4),
        ],
      },
      {
        batting: "Chennai Lions",
        bowling: "Royal Strikers",
        events: [
          bat("Ravi"), bat("Bala"), bowl("Prakash"),
          b(0), b(4), b(1), b(1), b(0, "wd"), b(6), b(0),
          bowl("Senthil"),
          b(1), b(2), out("lbw"), bat("Mani"), b(4), b(0), b(1),
          bowl("Prakash"),
          b(1), b(6), b(0), b(2),
        ],
      },
    ],
  }
  return { players, matches: [done, live] }
}
