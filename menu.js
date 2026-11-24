// Menu from the Silong Café printed menu. Prices in PHP. p = [[variant, price], ...]
const ICED_HOT = (i, h) => [
  ["Iced", i],
  ["Hot", h],
];
const ICED = (i) => [["Iced", i]];
module.exports = {
  addons: [
    { name: "Extra espresso shot", price: 50 },
    { name: "Oat milk", price: 40 },
    { name: "Whipped cream", price: 30 },
  ],
  tags: {
    best: "★ Best seller",
    barista: "♛ Barista’s choice",
    sig: "Signature",
    new: "New",
  },
  categories: [
    {
      id: "espresso",
      name: "Espresso",
      items: [{ n: "Espresso", p: [["Single", 79]] }],
    },
    {
      id: "classic",
      name: "Classic Coffee",
      items: [
        { n: "Americano", p: ICED_HOT(89, 99) },
        { n: "Latte", p: ICED_HOT(109, 119) },
        { n: "Spanish Latte", t: "best", p: ICED_HOT(129, 139) },
        { n: "French Vanilla", p: ICED_HOT(139, 149) },
        { n: "White Mocha", p: ICED_HOT(139, 149) },
        { n: "Caramel Macchiato", t: "best", p: ICED_HOT(139, 149) },
        { n: "Dark Mocha", p: ICED_HOT(139, 149) },
      ],
    },
    {
      id: "signature",
      name: "Signature Coffee",
      items: [
        {
          n: "Silong Latte",
          t: "best",
          d: "Our unique recipe: smooth, creamy latte with a hint of caramel and a secret recipe.",
          p: ICED_HOT(159, 169),
        },
        {
          n: "Ginhawa",
          t: "barista",
          d: "A daily creation crafted by our barista. Roasted sesame.",
          p: ICED(169),
        },
        {
          n: "Yakap (Biscoff Latte)",
          t: "sig",
          d: "Creamy Biscoff cookie butter blended for a warm, comforting sip.",
          p: ICED(179),
        },
        {
          n: "Pahinga (Peanut Brulee)",
          t: "sig",
          d: "Creamy roasted peanut with a taste of brulee sweetness.",
          p: ICED(149),
        },
        {
          n: "Payapa (Caramel Mocha)",
          t: "sig",
          d: "Caramel sweetness blended with rich chocolate.",
          p: ICED(159),
        },
      ],
    },
    {
      id: "noncoffee",
      name: "Non-Coffee",
      items: [
        { n: "Strawberry Au Lait", p: ICED(129) },
        { n: "Ube Au Lait", t: "best", p: ICED_HOT(139, 149) },
        { n: "White Chocolate Au Lait", t: "new", p: ICED_HOT(129, 139) },
        { n: "Chocolate Au Lait", p: ICED_HOT(129, 139) },
      ],
    },
    {
      id: "matcha",
      name: "Matcha Series",
      items: [
        { n: "Matcha", t: "best", p: ICED_HOT(129, 139) },
        { n: "Ube Matcha", p: ICED(139) },
        { n: "Strawberry Matcha", t: "best", p: ICED(149) },
        { n: "Oreo Matcha", p: ICED(149) },
      ],
    },
    {
      id: "frappe",
      name: "Frappe Series",
      note: "Available in coffee or milk base",
      items: [
        {
          n: "Chocolate Java Chip",
          t: "best",
          p: [
            ["Coffee base", 159],
            ["Milk base", 159],
          ],
        },
        {
          n: "Mocha",
          p: [
            ["Coffee base", 159],
            ["Milk base", 159],
          ],
        },
        {
          n: "Caramel",
          p: [
            ["Coffee base", 159],
            ["Milk base", 159],
          ],
        },
        {
          n: "Cookies and Cream",
          p: [
            ["Coffee base", 159],
            ["Milk base", 159],
          ],
        },
      ],
    },
    {
      id: "yogurt",
      name: "Yogurt Series",
      note: "Iced only",
      items: ["Honey Peach", "Strawberry", "Lychee", "Green Apple"].map(
        (n) => ({ n: n + " Yogurt", p: ICED(119) }),
      ),
    },
    {
      id: "kislap",
      name: "Kislap Refresher",
      note: "Iced only",
      items: [
        "Green Apple",
        "Green Apple-Strawberry",
        "Passion Fruit",
        "Blueberry",
        "Honey Peach",
        "Lychee",
      ].map((n) => ({ n: n + " Soda", p: ICED(99) })),
    },
  ],
};
