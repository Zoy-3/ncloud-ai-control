export function readEnvValue(contents: string, key: string): string | null {
  const prefix = `${key}=`;
  const line = contents
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(prefix));

  if (line === undefined) {
    return null;
  }

  const rawValue = line.slice(prefix.length).trim();
  if (
    rawValue.length >= 2 &&
    ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'")))
  ) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
}

export function upsertEnvValue(
  contents: string,
  key: string,
  value: string,
): string {
  const newline = contents.includes("\r\n") ? "\r\n" : "\n";
  const lines = contents.length === 0 ? [] : contents.split(/\r?\n/);
  const prefix = `${key}=`;
  let replaced = false;

  const updatedLines = lines.filter((line) => {
    if (!line.startsWith(prefix)) {
      return true;
    }

    if (!replaced) {
      replaced = true;
      return true;
    }

    return false;
  });

  if (replaced) {
    const index = updatedLines.findIndex((line) => line.startsWith(prefix));
    updatedLines[index] = `${prefix}${value}`;
  } else {
    while (updatedLines.at(-1) === "") {
      updatedLines.pop();
    }
    updatedLines.push(`${prefix}${value}`);
  }

  return `${updatedLines.join(newline)}${newline}`;
}
