export type Actor =
  | { kind: "user";  userId: string }
  | { kind: "agent"; userId: string; clientId: string; clientName: string };
