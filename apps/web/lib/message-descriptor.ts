export type MessageDescriptor = {
  key: string;
  values?: Record<string, string | number>;
};

export function translateMessage(
  t: (key: string, values?: Record<string, string | number>) => string,
  message: MessageDescriptor,
) {
  return message.values ? t(message.key, message.values) : t(message.key);
}
