import { assertEquals } from "https://deno.land/std@0.120.0/testing/asserts.ts";
import { Duckling } from "../mod.ts";

const text = `
    That means there could be a danger to life or potential serious illness from the scorching heat.
    The amber alert will run from Saturday until Tuesday - temperatures are expected to peak on Tuesday, with highs of 36C (96.8F) forecast.
    On Wednesday the top temperatures have been in south and south-east England.
    By late afternoon Gosport Fleetlands, Hampshire, recorded less than 30.1°C - the highest temperature of the day so far, according to the Met Office.
    In Frittenden, Kent, temperatures rose to 29.8C, and in Wiggonholt, West Sussex, it climbed to 29.4C. In London's St James's Park they hit 29C.
    The heatwave is due to high pressure and hot air flowing to the UK from southern Europe, where temperatures in Madrid climbed to 39C.
    After slightly lower temperatures in the UK for the next couple of days, the heat is set to build over the weekend, with temperatures in the high 20°s and reaching 26C in some areas on Sunday.
    The Met Office predicts maximum temperatures could be in excess of 35C in central and south-east England, by Monday.
`;

Deno.test("temp", () => {
  const res = Duckling.Extract({
    text,
    index: 0,
  });

  assertEquals(res.success, true);

  if (res.success) {
    assertEquals(res.value, [
      {
        end: 226,
        kind: "temperature",
        start: 221,
        text: "36C (",
        value: {
          amount: 36,
          unit: "Celsius",
        },
      },
      {
        end: 233,
        kind: "temperature",
        start: 226,
        text: "96.8F) ",
        value: {
          amount: 96.8,
          unit: "Fahrenheit",
        },
      },
      {
        end: 405,
        kind: "temperature",
        start: 386,
        text: "less than 30.1°C - ",
        value: {
          amount: -30.1,
          unit: "Celsius",
        },
      },
      {
        end: 530,
        kind: "temperature",
        start: 523,
        text: "29.8C, ",
        value: {
          amount: 29.8,
          unit: "Celsius",
        },
      },
      {
        end: 583,
        kind: "temperature",
        start: 576,
        text: "29.4C. ",
        value: {
          amount: 29.4,
          unit: "Celsius",
        },
      },
      {
        end: 629,
        kind: "temperature",
        start: 620,
        text: "29C.\n    ",
        value: {
          amount: 29,
          unit: "Celsius",
        },
      },
      {
        end: 767,
        kind: "temperature",
        start: 758,
        text: "39C.\n    ",
        value: {
          amount: 39,
          unit: "Celsius",
        },
      },
      {
        end: 916,
        kind: "temperature",
        start: 913,
        text: "20°",
        value: {
          amount: 20,
          unit: "N/A",
        },
      },
      {
        end: 935,
        kind: "temperature",
        start: 931,
        text: "26C ",
        value: {
          amount: 26,
          unit: "Celsius",
        },
      },
      {
        end: 1035,
        kind: "temperature",
        start: 1031,
        text: "35C ",
        value: {
          amount: 35,
          unit: "Celsius",
        },
      },
    ]);
  }
});
