const patterns: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "010", "010", "111"],
  "2": ["111", "001", "001", "111", "100", "100", "111"],
  "3": ["111", "001", "001", "111", "001", "001", "111"],
  "4": ["101", "101", "101", "111", "001", "001", "001"],
  "5": ["111", "100", "100", "111", "001", "001", "111"],
  "6": ["111", "100", "100", "111", "101", "101", "111"],
  "7": ["111", "001", "001", "010", "010", "010", "010"],
  "8": ["111", "101", "101", "111", "101", "101", "111"],
  "9": ["111", "101", "101", "111", "001", "001", "111"],
};

export function DotNumber({ value }: { value: string }) {
  return (
    <span className="dot-number" aria-label={value}>
      {value.split("").map((character, characterIndex) => (
        <span className="dot-digit" key={`${character}-${characterIndex}`} aria-hidden="true">
          {(patterns[character] ?? patterns["0"]).flatMap((row, rowIndex) =>
            row.split("").map((cell, columnIndex) => (
              <i
                key={`${rowIndex}-${columnIndex}`}
                className={cell === "1" ? "is-on" : ""}
              />
            )),
          )}
        </span>
      ))}
    </span>
  );
}
