const Contextizer = require('.');

let context = new Contextizer();

context.register('a').asInput();
context.register('b').asConstant(5);
context.register('sum').asFunction({
  deps: [ 'a', 'b' ], // dependencies.
  func({ a, b }) {
    return a + b;
  }
});
context.register('product').asFunction({
  deps: [ 'a', 'b' ],
  func({ a, b }) {
    return a * b;
  }
});
context.register('info').asFunction({
  deps: [ 'sum', 'product' ],
  func({ sum, product }) {
    console.log(`The sum of a and b is ${sum}.`);
    console.log(`The product of a and b is ${product}.`);
  }
});

// Execute 'info' with input a = 4.
context.execute('info', { a: 4 });
// "The sum of a and b is 9."
// "The product of a and b is 20."
