import {
  convertMinor,
  makeRateLookup,
  convertWithRates,
  sumConverted,
} from "./convert";
import { formatMoney, formatMoneyForSpeech } from "./format";
import { fromMinor, parseAmountText, toMinor } from "./parse";
import { currencySymbol, minorDigits } from "./currencies";
import { groupInteger, resolveNumberLocale } from "./locales";

describe("formatMoney", () => {
  it("groups en-IN as lakhs", () => {
    expect(formatMoney(12345600, "INR", { locale: "en-IN" })).toBe(
      "₹1,23,456.00",
    );
    expect(formatMoney(999999999999, "INR", { locale: "en-IN" })).toBe(
      "₹9,99,99,99,999.99",
    );
    expect(formatMoney(12300, "INR", { locale: "en-IN" })).toBe("₹123.00");
  });

  it("groups en-US by thousands", () => {
    expect(formatMoney(12345600, "USD", { locale: "en-US" })).toBe(
      "$123,456.00",
    );
    expect(formatMoney(5, "USD", { locale: "en-US" })).toBe("$0.05");
  });

  it("uses locale separators and suffix symbol for de-DE", () => {
    expect(formatMoney(123456789, "EUR", { locale: "de-DE" })).toBe(
      "1.234.567,89 €",
    );
    expect(formatMoney(-50, "EUR", { locale: "de-DE" })).toBe("−0,50 €");
  });

  it("handles 0-decimal and 3-decimal currencies", () => {
    expect(formatMoney(1234567, "JPY", { locale: "ja-JP" })).toBe("¥1,234,567");
    expect(formatMoney(1234567, "KWD", { locale: "en-US" })).toBe(
      "KWD1,234.567",
    );
  });

  it("falls back to the code for unknown currencies", () => {
    expect(currencySymbol("xyz")).toBe("XYZ");
    expect(minorDigits("XYZ")).toBe(2);
    expect(formatMoney(100, "xyz", { locale: "en-US" })).toBe("XYZ1.00");
  });

  it("places the sign before the symbol using U+2212", () => {
    expect(formatMoney(124000, "INR", { locale: "en-IN", sign: "minus" })).toBe(
      "−₹1,240.00",
    );
    expect(formatMoney(124000, "INR", { locale: "en-IN", sign: "plus" })).toBe(
      "+₹1,240.00",
    );
    expect(formatMoney(-124000, "INR", { locale: "en-IN" })).toBe("−₹1,240.00");
    expect(formatMoney(-124000, "INR", { locale: "en-IN", sign: "none" })).toBe(
      "₹1,240.00",
    );
    expect(formatMoney(0, "INR", { locale: "en-IN", sign: "minus" })).toBe(
      "₹0.00",
    );
  });

  it("honours the decimals option with half-up rounding", () => {
    expect(formatMoney(124050, "INR", { locale: "en-IN", decimals: 0 })).toBe(
      "₹1,241",
    );
    expect(formatMoney(124049, "INR", { locale: "en-IN", decimals: 0 })).toBe(
      "₹1,240",
    );
    expect(formatMoney(124049, "JPY", { decimals: 2 })).toBe("¥124,049");
  });

  it("compacts as K/L/Cr for INR and en-IN", () => {
    const f = (major: number, o: object = {}) =>
      formatMoney(major * 100, "INR", { locale: "en-IN", compact: true, ...o });
    expect(f(950)).toBe("₹950");
    expect(f(1200)).toBe("₹1.2K");
    expect(f(1000)).toBe("₹1K");
    expect(f(120000)).toBe("₹1.2L");
    expect(f(12000000)).toBe("₹1.2Cr");
    expect(f(9995000)).toBe("₹1Cr");
    expect(f(123400000000)).toBe("₹12,340Cr");
    expect(
      formatMoney(120000 * 100, "INR", { locale: "en-US", compact: true }),
    ).toBe("₹1.2L");
  });

  it("compacts as K/M/B elsewhere", () => {
    const f = (major: number, o: object = {}) =>
      formatMoney(major * 100, "USD", { locale: "en-US", compact: true, ...o });
    expect(f(1200)).toBe("$1.2K");
    expect(f(1500000)).toBe("$1.5M");
    expect(f(2000000000)).toBe("$2B");
    expect(f(999960)).toBe("$1M");
    expect(f(1500000, { sign: "minus" })).toBe("−$1.5M");
    expect(
      formatMoney(1200, "USD", {
        locale: "en-US",
        compact: true,
        sign: "plus",
      }),
    ).toBe("+$12");
  });

  it("formats speech with sign and currency name", () => {
    expect(formatMoneyForSpeech(-124000, "INR")).toBe("minus 1,240 rupees");
    expect(formatMoneyForSpeech(1234, "USD")).toBe("12.34 US dollars");
    expect(formatMoneyForSpeech(100, "USD")).toBe("1 US dollar");
    expect(formatMoneyForSpeech(500, "EUR", { sign: "plus" })).toBe(
      "plus 5 euros",
    );
    expect(formatMoneyForSpeech(300, "XYZ")).toBe("3 XYZ");
  });
});

describe("locales", () => {
  it("resolves region and language fallbacks", () => {
    expect(resolveNumberLocale("en_IN").style).toBe("indian");
    expect(resolveNumberLocale("hi").style).toBe("indian");
    expect(resolveNumberLocale("ta-IN").style).toBe("indian");
    expect(resolveNumberLocale("de-AT").decimal).toBe(",");
    expect(resolveNumberLocale(undefined).decimal).toBe(".");
    expect(groupInteger("1234567", resolveNumberLocale("en-IN"))).toBe(
      "12,34,567",
    );
  });
});

describe("parseAmountText", () => {
  it("parses to integer minor units", () => {
    expect(parseAmountText("1,23,456.50", "INR")).toBe(12345650);
    expect(parseAmountText("₹340", "INR")).toBe(34000);
    expect(parseAmountText("12.5", "USD")).toBe(1250);
    expect(parseAmountText("0.1", "USD")).toBe(10);
    expect(parseAmountText("1.005", "USD")).toBe(101);
    expect(parseAmountText("1234", "JPY")).toBe(1234);
    expect(parseAmountText("-12", "USD")).toBe(-1200);
  });
  it("disambiguates separators", () => {
    expect(parseAmountText("1.234,56", "EUR", "de-DE")).toBe(123456);
    expect(parseAmountText("1,234", "USD")).toBe(123400);
    expect(parseAmountText("12,5", "EUR", "de-DE")).toBe(1250);
  });
  it("rejects non numbers", () => {
    expect(parseAmountText("swiggy", "INR")).toBeNull();
    expect(parseAmountText("", "INR")).toBeNull();
    expect(parseAmountText(".", "INR")).toBeNull();
    expect(parseAmountText("12abc", "INR")).toBeNull();
  });
});

describe("toMinor / fromMinor", () => {
  it("round-trips without floats", () => {
    for (const v of [0, 1, 99, 100, 123456789, -250]) {
      expect(toMinor(fromMinor(v, "USD"), "USD")).toBe(v);
    }
    expect(fromMinor(5, "USD")).toBe("0.05");
    expect(fromMinor(-1250, "USD")).toBe("-12.50");
    expect(fromMinor(1234, "JPY")).toBe("1234");
    expect(fromMinor(1234, "KWD")).toBe("1.234");
  });
});

describe("conversion", () => {
  it("converts across minor digit counts", () => {
    expect(convertMinor(1200, "USD", "INR", 83.2)).toBe(99840);
    expect(convertMinor(10000, "INR", "JPY", 1.8)).toBe(180);
    expect(convertMinor(500, "USD", "USD", 99)).toBe(500);
  });
  it("looks up direct, inverse and missing rates", () => {
    const lookup = makeRateLookup([{ base: "USD", quote: "INR", rate: 80 }]);
    expect(lookup("USD", "INR")).toBe(80);
    expect(lookup("INR", "USD")).toBe(1 / 80);
    expect(lookup("EUR", "INR")).toBeNull();
    expect(convertWithRates(100, "EUR", "INR", lookup)).toBe(100);
    expect(convertWithRates(100, "USD", "INR", lookup)).toBe(8000);
  });
});

describe("sumConverted", () => {
  const lookup = makeRateLookup([{ base: "USD", quote: "EUR", rate: 0.9 }]);
  it("converts with rates and excludes currencies without one", () => {
    const items = [
      { minor: 1000, currency: "EUR" },
      { minor: 10000, currency: "USD" },
      { minor: 5000, currency: "GBP" },
    ];
    expect(sumConverted(items, "EUR", lookup)).toEqual({
      total: 10000,
      excluded: 1,
    });
  });
  it("is zero for an empty list", () => {
    expect(sumConverted([], "EUR", lookup)).toEqual({ total: 0, excluded: 0 });
  });
});

describe("masking", () => {
  const { maskLocale, maskMoney, isMaskedLocale } = jest.requireActual(
    "./format",
  ) as typeof import("./format");
  it("keeps sign and symbol, hides the digits", () => {
    const l = maskLocale("en-IN", true);
    expect(isMaskedLocale(l)).toBe(true);
    expect(formatMoney(-124000, "INR", { locale: l, sign: "minus" })).toBe(
      "−₹••••",
    );
    expect(formatMoney(124000, "INR", { locale: l, sign: "plus" })).toBe(
      "+₹••••",
    );
    expect(formatMoney(124000, "INR", { locale: l, compact: true })).toBe(
      "₹••",
    );
    expect(
      formatMoney(124000, "EUR", { locale: maskLocale("de-DE", true) }),
    ).toBe("•••• €");
  });
  it("round trips and leaves unmasked locales alone", () => {
    expect(maskLocale(maskLocale("en-IN", true), false)).toBe("en-IN");
    expect(
      formatMoney(124000, "INR", { locale: maskLocale("en-IN", false) }),
    ).toBe("₹1,240.00");
    expect(
      formatMoneyForSpeech(100, "USD", { locale: maskLocale("en-US", true) }),
    ).toBe("Hidden");
  });
  it("masks an already formatted string", () => {
    expect(maskMoney("−₹1,24,000.50")).toBe("−₹••••");
    expect(maskMoney("$1.2K")).toBe("$••••");
    expect(maskMoney("••••")).toBe("••••");
  });
});
