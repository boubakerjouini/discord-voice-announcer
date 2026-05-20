import type { AnnouncementStyle } from "./configService.js";

const JOIN_MESSAGES: Record<AnnouncementStyle, string[]> = {
  formal: [
    "${name} has joined the channel",
  ],
  fun: [
    "Look who decided to show up... ${name}!",
    "Everyone welcome ${name}!",
    "${name} just crashed the party!",
    "Hide your snacks, ${name} is here!",
    "It's a bird, it's a plane... no, it's ${name}!",
  ],
  robot: [
    "New user detected. Identification: ${name}. Status: online.",
    "Scanning... ${name} recognized. Access granted.",
    "System alert. ${name} has entered the voice matrix.",
  ],
  medieval: [
    "Hear ye, hear ye! ${name} has entered the royal chamber!",
    "The gates open for ${name}! All rise!",
    "A wild ${name} approaches the castle!",
  ],
  pirate: [
    "Ahoy! ${name} has boarded the ship!",
    "Shiver me timbers! ${name} is aboard, mateys!",
    "Arrr, ${name} has joined the crew!",
  ],
};

const LEAVE_MESSAGES: Record<AnnouncementStyle, string[]> = {
  formal: [
    "${name} has left the channel",
  ],
  fun: [
    "${name} has left the building!",
    "And just like that, ${name} vanished!",
    "${name} ghosted us!",
    "Poof! ${name} is gone!",
    "${name} rage quit!",
  ],
  robot: [
    "User disconnected. Identification: ${name}. Signal lost.",
    "Warning. ${name} has gone offline. Connection terminated.",
    "${name} has exited the voice matrix.",
  ],
  medieval: [
    "Alas! ${name} has departed from the kingdom!",
    "${name} has fled the castle! Sound the alarm!",
    "The brave ${name} rides off into the sunset!",
  ],
  pirate: [
    "${name} has walked the plank!",
    "${name} has abandoned ship!",
    "Man overboard! ${name} is gone!",
  ],
};

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function getJoinMessage(name: string, style: AnnouncementStyle): string {
  return randomPick(JOIN_MESSAGES[style]).replace("${name}", name);
}

export function getLeaveMessage(name: string, style: AnnouncementStyle): string {
  return randomPick(LEAVE_MESSAGES[style]).replace("${name}", name);
}
