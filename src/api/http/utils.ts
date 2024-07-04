import { Signature, WeierstrassSignatureType } from "starknet";

export function stall(duration: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, duration);
  });
}

export function castToApiSignature(s: Signature): [string, string] {
  let sign = <WeierstrassSignatureType>s;
  return [sign.r.toString(), sign.s.toString()];
}

export function isConvertibleToBigint(value: any): boolean {
  if (typeof value === "string") {
    // Check if the string represents an integer or hex value
    return /^\d+$/.test(value) || /^0x[0-9a-fA-F]+$/.test(value);
  }
  return false;
}

/**
 * Checks if a value is an object and not a primitive type.
 * @param value - The value to check.
 * @returns True if the value is an object, false otherwise.
 */
function isObject(value: any): value is object {
  return value !== null && typeof value === "object";
}

export function convertToBigintRecursively<T>(
  obj: T,
  excludedFields: string[] = [],
): T {
  if (isConvertibleToBigint(obj)) return BigInt(obj as any) as T;

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      convertToBigintRecursively(item, excludedFields),
    ) as T;
  }
  if (!isObject(obj)) return obj;

  for (const key in obj) {
    if (obj.hasOwnProperty(key) && !excludedFields.includes(key)) {
      const value = obj[key];
      if (isConvertibleToBigint(value)) {
        obj[key] = BigInt(value as any) as any;
      } else if (Array.isArray(value)) {
        obj[key] = value.map((item) =>
          convertToBigintRecursively(item, excludedFields),
        ) as any;
      } else if (isObject(value)) {
        obj[key] = convertToBigintRecursively(value, excludedFields);
      }
    }
  }
  return obj;
}

export function bigIntReplacer(_key: string, value: any): any {
  return typeof value === "bigint" ? value.toString() : value;
}

type CustomParser<T> = (value: any) => T;
export function convertFieldsRecursively<T>(
  obj: T,
  fieldsToParse: Set<string>,
  parser: CustomParser<any>,
): T {
  if (!isObject(obj)) return obj;

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];

      if (fieldsToParse.has(key)) {
        obj[key] = parser(value) as any;
      } else if (Array.isArray(value)) {
        obj[key] = value.map((item) =>
          convertFieldsRecursively(item, fieldsToParse, parser),
        ) as any;
      } else if (isObject(value)) {
        obj[key] = convertFieldsRecursively(value, fieldsToParse, parser);
      }
    }
  }
  return obj;
}
