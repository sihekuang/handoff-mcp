import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const id10 = customAlphabet(alphabet, 10);
const id12 = customAlphabet(alphabet, 12);

export const newHandoffId = () => `h_${id10()}`;
export const newUserId = () => `u_${id12()}`;
