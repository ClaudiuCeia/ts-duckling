import type { Parser } from "@claudiu-ceia/combine";
import {
  ApiKey,
  BIC,
  CreditCard,
  CryptoAddress,
  Email,
  IBAN,
  Institution,
  IPAddress,
  JWT,
  Language,
  Location,
  MACAddress,
  Phone,
  Quantity,
  Range,
  SSN,
  Temperature,
  Time,
  URL,
  UUID,
} from "@claudiu-ceia/ts-duckling";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const registry = {
  Range: Range.parser,
  Time: Time.parser,
  Temperature: Temperature.parser,
  Quantity: Quantity.parser,
  Location: Location.parser,
  URL: URL.parser,
  Email: Email.parser,
  Institution: Institution.parser,
  Language: Language.parser,
  Phone: Phone.parser,
  IPAddress: IPAddress.parser,
  SSN: SSN.parser,
  CreditCard: CreditCard.parser,
  UUID: UUID.parser,
  ApiKey: ApiKey.parser,
  IBAN: IBAN.parser,
  MACAddress: MACAddress.parser,
  JWT: JWT.parser,
  CryptoAddress: CryptoAddress.parser,
  BIC: BIC.parser,
} satisfies Record<string, Parser<any>>;

export type ParserId = keyof typeof registry;
