export const NATIVE_GAMES = [
 {id:'number-memory',title:'Number Memory',instruction:'Memorise the six-digit number, then type it back after it disappears.'},
 {id:'quick-maths',title:'Quick Maths',instruction:'Add the two numbers and enter the six-digit answer.'},
 {id:'reverse-code',title:'Reverse Code',instruction:'Read the six-digit code and enter its digits in reverse order.'},
 {id:'digit-order',title:'Digit Order',instruction:'Arrange all six digits from smallest to largest. Keep repeated digits and leading zeroes.'},
 {id:'digit-shift',title:'Digit Shift',instruction:'Add one to each digit separately, keeping the same order. After 9 comes 0.'}
];
export const NATIVE_GAME_IDS = NATIVE_GAMES.map(game=>game.id);
