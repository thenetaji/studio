import type { Insights } from "@/data/hooks";
import {
  donutData,
  donutKey,
  donutRows,
  keyForName,
  listItems,
  summaryLabel,
} from "./model";

const cat = (id: string, name: string, color: string) =>
  ({ id, name, color, icon: "tag.fill", kind: "expense" }) as never;
const row = (
  id: string | null,
  amount: number,
  percent: number,
  category = id ? cat(id, id.toUpperCase(), "red") : null,
) => ({ categoryId: id, amount, percent, category });

const insights = {
  currency: "INR",
  kind: "expense",
  total: 1000,
  categories: [
    row("a", 500, 50),
    row("b", 300, 30),
    row("c", 100, 10),
    row(null, 100, 10),
  ],
  donut: [
    { ...row("a", 500, 50), isOther: false },
    { ...row("b", 300, 30), isOther: false },
    {
      categoryId: null,
      amount: 200,
      percent: 20,
      isOther: true,
      category: null,
    },
  ],
} as unknown as Insights;

describe("insights model", () => {
  it("keys donut rows", () => {
    expect(donutKey({ categoryId: "a" })).toBe("a");
    expect(donutKey({ categoryId: null, isOther: true })).toBe("other");
    expect(donutKey({ categoryId: null })).toBe("none");
  });
  it("filters the list by donut selection", () => {
    expect(listItems(insights, null)).toHaveLength(4);
    expect(listItems(insights, "a").map((i) => i.id)).toEqual(["a"]);
    expect(listItems(insights, "other").map((i) => i.id)).toEqual(["c", null]);
  });
  it("builds donut data with a gray Other", () => {
    const data = donutData(insights, {
      currency: "INR",
      locale: "en-IN",
      showDecimals: false,
      scheme: "light",
    });
    expect(data.map((d) => d.name)).toEqual(["A", "B", "Other"]);
    expect(data[0]?.amountLabel).toBe("₹5");
    expect(data[2]?.color).toBe("#8E8E93");
  });
  it("folds categories beyond the sixth into Other", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      ...row(`c${i}`, 100 - i, 10),
      isOther: false,
    }));
    const big = {
      ...insights,
      donut: [
        ...many,
        {
          categoryId: null,
          amount: 50,
          percent: 5,
          isOther: true,
          category: null,
        },
      ],
    } as unknown as Insights;
    const rows = donutRows(big);
    expect(rows).toHaveLength(7);
    expect(rows[6]).toMatchObject({
      isOther: true,
      amount: 94 + 93 + 50,
      percent: 25,
    });
  });
  it("resolves names and summarises for accessibility", () => {
    expect(keyForName(insights, "b")).toBe("b");
    expect(keyForName(insights, "Other")).toBe("other");
    expect(keyForName(insights, "zzz")).toBeNull();
    expect(summaryLabel(insights, "expense")).toBe(
      "Spending by category: A 50%, B 30%, Other 20%",
    );
  });
});
