/* Blog fixtures. Bodies are markdown, as the editor stores them. */

export const BLOG_SEED = [
  {
    id: 501,
    title: 'Boiled, Fried or Roasted: Why Preparation Changes Everything',
    slug: 'boiled-fried-or-roasted',
    status: 'published',
    publishDate: '2026-08-11',
    createdAt: '2026-08-08',
    tags: ['Nutrition', 'West African Food'],
    image: 'meals/jollof-rice.jpg',
    excerpt: 'The same yam can differ by a third in calories depending on how it meets the heat. Here is what the WAFCT numbers actually show.',
    body: `Ask what is in a plate of yam and the honest answer is a question back: boiled or fried?

## The same food, different numbers

The West African Food Composition Table lists yam more than a dozen times, because preparation is not a rounding error. Boiled yam, drained, and yam deep-fried in vegetable oil are different foods nutritionally, even though the tuber came out of the same sack.

- **Boiled, drained** — water goes in, some soluble content leaches out
- **Fried** — oil goes in, and the fat figure moves sharply
- **Roasted** — moisture leaves, so everything else concentrates per 100g

> The tuber did not change. What we did to it did.

## Why this trips up meal planning

Most apps store one entry per ingredient and call it done. That is how "Boiled Yam" ends up carrying the numbers for a fried record — a mistake worth catching, because it lands on the plate of someone counting carefully.

## What to do about it

1. Record the preparation with the ingredient, not as an afterthought.
2. Prefer the atomic entry over "as part of a recipe" where you have the choice.
3. When the table has no entry for how you cooked it, say so rather than guessing.`,
    seoTitle: 'Boiled, Fried or Roasted: Preparation and Nutrition',
    seoDescription: 'The same yam can differ by a third in calories depending on preparation. What the WAFCT data shows.',
  },
  {
    id: 502,
    title: 'Egusi Is Not the Problem',
    slug: 'egusi-is-not-the-problem',
    status: 'published',
    publishDate: '2026-07-29',
    createdAt: '2026-07-26',
    tags: ['Recipes', 'Health'],
    image: 'meals/oha-soup.jpg',
    excerpt: 'Melon seed gets blamed for a lot. Most of what people are reacting to is the palm oil and the swallow beside it.',
    body: `Egusi has a reputation it did not earn on its own.

## Where the calories actually sit

Ground melon seed is a seed — dense, yes, but also the source of most of the protein in the bowl. The figure people react to usually comes from two other places: the palm oil the paste is fried in, and the swallow served alongside.

- A cup of egusi soup is not the meal
- The swallow is frequently two thirds of the carbohydrate on the tray
- Palm oil is 900 kcal per 100g, and it is rarely measured

## A more useful question

Instead of "is egusi fattening", ask how much oil went in, and how much swallow is on the plate. Those two answers move the number far more than swapping the soup.`,
    seoTitle: 'Egusi Is Not the Problem',
    seoDescription: 'Where the calories in a bowl of egusi actually come from.',
  },
  {
    id: 503,
    title: 'What We Learned Building the Ingredient Library',
    slug: 'building-the-ingredient-library',
    status: 'published',
    publishDate: '2026-07-15',
    createdAt: '2026-07-10',
    tags: ['Product Updates', 'Ingredients'],
    image: 'meals/veg-stirfry.jpg',
    excerpt: 'Nine hundred and sixty foods, a matcher that has to understand "ewedu" means jute mallow, and one bug that taught us to be careful.',
    body: `Matching what people type to what a food composition table calls it is harder than it sounds.

## Local names are the easy part

An alias map handles most of it — egusi is melon seed, ewedu is jute mallow, crayfish is shrimp. That work is finite and it stays done.

## Preparation is the hard part

The bug that taught us this: *Boiled Yam* matched a **fried** yam record, because both were "cooked". Two entirely different fat figures, and nothing on screen to suggest anything was wrong.

> A wrong number that looks right is worse than a gap.

The rule now is that a named preparation is honoured exactly, or we fall back to raw. Never to some other cooked variant. There is a regression test with that bug's name on it.`,
    seoTitle: 'Building the Akaani Ingredient Library',
    seoDescription: 'Matching local food names to composition data, and the bug that shaped the rules.',
  },
  {
    id: 504,
    title: 'Meal Prepping Jollof That Survives the Week',
    slug: 'meal-prepping-jollof',
    status: 'draft',
    publishDate: null,
    createdAt: '2026-08-16',
    tags: ['Meal Planning', 'Recipes'],
    image: 'blog/meal-prep.jpg',
    excerpt: '',
    body: `Reheated jollof has a reputation for going dry and hard. It does not have to.

## Cook it slightly wetter than you want it

Rice keeps losing moisture in the fridge.

## Cool it fast, store it flat

TODO: finish this section — food safety notes and portioning.`,
  },
  {
    id: 505,
    title: 'Reading a Nigerian Food Label Without the Marketing',
    slug: 'reading-a-nigerian-food-label',
    status: 'archived',
    publishDate: '2026-05-02',
    createdAt: '2026-04-28',
    tags: ['Nutrition', 'Community'],
    image: 'blog/market-garden-eggs.jpg',
    excerpt: 'An older piece, kept for reference. Superseded by the ingredients guide.',
    body: `Front-of-pack claims are marketing. The panel on the back is the part worth reading.

## Per 100g, not per serving

Serving sizes are chosen by the manufacturer. Per 100g is the only figure you can compare across two products.`,
  },
];
