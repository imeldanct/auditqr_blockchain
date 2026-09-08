export function isValidLength(value: string, min: number, max: number): boolean {
  const len = value.trim().length;
  return len >= min && len <= max;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

export function isValidRcNumber(rcNumber: string): boolean {
  return /^RC-\d{6}$/.test(rcNumber);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 72;
}
