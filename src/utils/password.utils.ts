import { randomInt } from 'crypto';

const LOWERCASE = 'abcdefghjkmnpqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*';
const ALL = LOWERCASE + UPPERCASE + DIGITS + SYMBOLS;

function pick(chars: string): string {
  return chars[randomInt(chars.length)];
}

function shuffle(values: string[]): string[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }

  return values;
}

export function generatePassword(length = 12): string {
  if (length < 8) {
    throw new Error('Password length must be at least 8 characters.');
  }

  const password = [
    pick(LOWERCASE),
    pick(UPPERCASE),
    pick(DIGITS),
    pick(SYMBOLS),
  ];

  while (password.length < length) {
    password.push(pick(ALL));
  }

  return shuffle(password).join('');
}
