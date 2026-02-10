import type { Parser } from "@claudiu-ceia/combine";
import {
  Range,
  Time,
  Temperature,
  Quantity,
  Location,
  URL,
  Email,
  Institution,
  Language,
  Phone,
  IPAddress,
  SSN,
  CreditCard,
  UUID,
  ApiKey,
} from "@claudiu-ceia/ts-duckling";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const registry: Record<string, Parser<any>> = {
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
};
