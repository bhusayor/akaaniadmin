/* Meal tag vocabulary. Categories group the tags; the tag→meal links
   live on the meals themselves. */

export const MEAL_TAG_SEED = [
  { id: 701, name: 'High Protein', category: 'Dietary', description: '25g or more of protein per serving.' },
  { id: 702, name: 'Low Carb', category: 'Dietary', description: 'Under 20g of carbohydrate per serving.' },
  { id: 703, name: 'Weight Loss', category: 'Dietary', description: 'Calorie-controlled portions built for a deficit.' },
  { id: 704, name: 'Gluten Free', category: 'Dietary', description: 'No wheat, barley or rye in any ingredient.' },
  { id: 705, name: 'Vegan', category: 'Dietary', description: 'No animal products, including stock and palm oil sourced with fish.' },

  { id: 706, name: 'Family Meals', category: 'Context', description: 'Scales to four or more without extra work.' },
  { id: 707, name: 'Kid Friendly', category: 'Context', description: 'Mild, familiar and easy to eat unassisted.' },
  { id: 708, name: 'Comfort Food', category: 'Context', description: 'The dishes people cook when they want the familiar one.' },
  { id: 709, name: '30-Minute Meals', category: 'Context', description: 'On the table in half an hour, start to finish.' },

  { id: 710, name: 'One-Pot Meal', category: 'Cooking Method', description: 'Cooked in a single pot — less washing up.' },
  { id: 711, name: 'No-Cook', category: 'Cooking Method', description: 'Requires no heat at all.' },
  { id: 712, name: 'Batch Cook', category: 'Cooking Method', description: 'Holds its texture for three days refrigerated.' },

  { id: 713, name: 'Holiday Special', category: 'Special Occasion', description: 'Christmas, Eid and New Year spreads.' },
  { id: 714, name: 'Party Platter', category: 'Special Occasion', description: 'Served to a crowd, eaten standing up.' },
  { id: 715, name: 'Date Night', category: 'Special Occasion', description: 'Worth the extra half hour.' },

  { id: 716, name: 'West African', category: 'Cuisine', description: 'Nigerian, Ghanaian and neighbouring traditions.' },
  { id: 717, name: 'East African', category: 'Cuisine', description: 'Kenyan, Tanzanian and neighbouring traditions.' },
];
