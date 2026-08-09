const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function encodeBase62(num) {
  if (num === 0) return chars[0];

  let result = "";

  while (num > 0) {
    result = chars[num % 62] + result;
    num = Math.floor(num / 62);
  }

  return result;
}

export function decodeBase62(str) {
  let num = 0;

  for (const ch of str) {
    num = num * 62 + chars.indexOf(ch);
  }

  return num;
}