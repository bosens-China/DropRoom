const LOCAL_NICKNAME_KEY = 'droproom-user-nickname';

export function getMyNickname(): string {
  const stored = localStorage.getItem(LOCAL_NICKNAME_KEY);
  if (stored) return stored;

  const adjectives = [
    '神秘',
    '快乐',
    '敏捷',
    '沉静',
    '炽热',
    '深邃',
    '优雅',
    '无畏',
  ];
  const nouns = [
    '极客',
    '节点',
    '信使',
    '原点',
    '光纤',
    '代码',
    '网关',
    '星宿',
  ];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const nickname = `${adjective}的${noun}`;
  localStorage.setItem(LOCAL_NICKNAME_KEY, nickname);
  return nickname;
}

export function setMyNickname(nickname: string): void {
  localStorage.setItem(LOCAL_NICKNAME_KEY, nickname);
}
