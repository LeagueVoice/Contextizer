const chai = require('chai');
const expect = chai.expect;

const Contextizer = require('./');
const delay = delay => new Promise(resolve => setTimeout(resolve, delay));

describe('Contextizer', function() {
  it('test basic', function(done) {
    let context = new Contextizer();
    context.register('final').asFunction({ // Test out of order.
      deps: [ 'left', 'right' ],
      func({ left, right }) {
        return [ left, right ];
      }
    });
    context.register('rootVal').asConstant('hello');
    context.register('left').asFunction({
      deps: [ 'rootVal' ],
      func({ rootVal, suffix }) {
        return rootVal + ' ' + suffix;
      },
      params: {
        suffix: 'world'
      }
    });
    context.register('right').asFunction({
      deps: [ 'rootVal' ],
      func({ rootVal }) {
        return rootVal + ' darkness my old friend';
      }
    });
    context.execute('final')
      .then(vals => {
        expect(vals[0]).to.equal('hello world');
        expect(vals[1]).to.equal('hello darkness my old friend');
      })
      .then(done, done);
  });

  it('test async', function(done) {
    let context = new Contextizer();
    context.register('final').asFunction({ // Test out of order.
      deps: [ 'left', 'right' ],
      func({ left, right }) {
        return [ left, right ];
      }
    });
    context.register('rootVal').asConstant(delay(10).then(() => 'hello'));
    context.register('left').asFunction({
      deps: [ 'rootVal' ],
      func({ rootVal, suffix }) {
        return rootVal + ' ' + suffix;
      },
      params: {
        suffix: 'world'
      }
    });
    context.register('right').asFunction({
      deps: [ 'rootVal' ],
      func({ rootVal }) {
        return delay(30).then(() => rootVal + ' darkness my old friend');
      }
    });
    context.execute('final')
      .then(vals => {
        expect(vals[0]).to.equal('hello world');
        expect(vals[1]).to.equal('hello darkness my old friend');
      })
      .then(done, done);
  });

  it('test params', function(done) {
    let context = new Contextizer();
    context.register('params').asFunction({
      deps: [],
      func({ vals }) {
        return vals.pop();
      },
      params: {
        vals: [ 5, 4, 3, 2, 1 ]
      }
    });
    context.execute('params').then(v => expect(v).to.equal(1))
      .then(() => context.execute('params')).then(v => expect(v).to.equal(2))
      .then(() => context.execute('params')).then(v => expect(v).to.equal(3))
      .then(() => done(), done);
  });

  it('test cached', function(done) {
    let context = new Contextizer();
    context.register('cached').asFunction({
      cached: true,
      deps: [],
      func({ vals }) {
        return vals.pop();
      },
      params: {
        vals: [ 5, 4, 3, 2, 1 ]
      }
    });
    context.execute('cached').then(v => expect(v).to.equal(1))
      .then(() => context.execute('cached')).then(v => expect(v).to.equal(1))
      .then(() => done(), done);
  });

  it('test cleanup', function(done) {
    let context = new Contextizer();
    // fake stack
    context.register('val').asFunction({
      deps: [],
      func({ vals }) {
        return vals.pop();
      },
      cleanup({ $value, vals }) {
        vals.push($value);
      },
      params: {
        vals: [ 5, 4, 3, 2, 1 ]
      }
    });
    context.register('result').asFunction({
      deps: [ 'val' ],
      func({ val }) {
        return delay(50).then(() => val);
      }
    });
    let a = context.execute('result').then(v => expect(v).to.equal(1));
    let b = context.execute('result').then(v => expect(v).to.equal(2));
    Promise.all([ a, b ])
      .then(() => delay(10))
      .then(() => context.execute('result'))
      .then(v => expect(v).to.be.lessThan(3))
      .then(() => done(), done);
  });

  it('test cleanup with error', function(done) {
    // Run previous stack test but throw error first two times
    // Check that the stack is repaired even after throw.
    let context = new Contextizer();
    context.register('doThrow').asInput();
    // fake stack
    context.register('val').asFunction({
      deps: [],
      func({ vals }) {
        return vals.pop();
      },
      cleanup({ $value, vals }) {
        vals.push($value);
      },
      params: {
        vals: [ 5, 4, 3, 2, 1 ]
      }
    });
    context.register('result').asFunction({
      deps: [ 'val', 'doThrow' ],
      func({ val, doThrow }) {
        return delay(50).then(() => {
          if (doThrow)
            throw 'err';
          return val;
        });
      }
    });
    let a = context.execute('result', { doThrow: true })
      .catch(v => expect(v).to.equal('err'));
    let b = context.execute('result', { doThrow: true })
      .catch(v => expect(v).to.equal('err'));
    Promise.all([ a, b ])
      .then(() => delay(10))
      .then(() => context.execute('result', { doThrow: false }))
      .then(v => expect(v).to.be.lessThan(3))
      .then(() => done(), done);
  });

  it('test namespace overlap', function(done) {
    let context = new Contextizer();
    context.register('foo').asInput();
    context.register('com.mingweisamuel.foo').asFunction({
      deps: [ 'foo' ],
      func({ foo }) {
        return 'namespaced ' + foo;
      }
    });
    context.register('com.mingweisamuel.result').asFunction({
      deps: [ '.foo', 'com.mingweisamuel.foo' ],
      func({ '.foo': foo, 'com.mingweisamuel.foo': foo2 }) {
        return { foo, foo2 };
      }
    });
    context.execute('com.mingweisamuel.result', { foo: 'foo' })
      .then(value => {
        expect(value.foo).to.equal('foo');
        expect(value.foo2).to.equal('namespaced foo');
      })
      .then(done, done);
  });

  it('test circular', function(done) {
    let context = new Contextizer();
    context.register('grass').asFunction({
      deps: [ 'dirt' ],
      func({ dirt }) {
        return dirt + ' -> grass';
      }
    });
    context.register('cow').asFunction({
      deps: [ 'grass' ],
      func({ grass }) {
        return grass + ' -> cow';
      }
    });
    context.register('pie').asFunction({
      deps: [ 'cow' ],
      func({ cow }) {
        return cow + ' -> pie';
      }
    });
    context.register('human').asFunction({
      deps: [ 'pie' ],
      func({ pie }) {
        return pie + ' -> human. Yum!';
      }
    });
    context.register('dirt').asFunction({
      deps: [ 'pie' ],
      func({ pie }) {
        return pie + ' -> dirt';
      }
    });
    try {
      context.execute('human').then(v => done('unexpected value ' + v));
    }
    catch(e) {
      expect(e.message).to
        .equal('Dependency Cycle Found: human -> pie -> cow -> grass -> dirt -> pie');
      done();
    }
  });

  it('test namespace misc', function(done) {
    let context = new Contextizer();
    context.register('user').asInput();
    context.register(); //TODO
    done();
  });

  for (let pct = 0.25; pct <= 1.0; pct += 0.25) {
    let nodes = 48 + 24 * (1 - pct);
    it(`test dense tree ${100 * pct}%, ${nodes} nodes`, function(done) {
      let vals = [];
      let context = new Contextizer();
      for (let i = 0; i < nodes; i++) {
        let deps = []; // Always required
        vals[i] = i;
        for (let j = 0; j < i; j++) {
          if (Math.random() < pct || j === i - 1) {
            vals[i] += vals[j];
            deps.unshift(j);
          }
        }
        deps = deps.map(dep => '' + dep); // Convert to string.
        context.register('' + i).asFunction({
          deps,
          func(arg) {
            return i + Object.values(arg).reduce((a, b) => a + b, 0);
          }
        });
      }
      context.execute('' + (nodes - 1))
        .then(value => {
          expect(value).to.equal(vals.pop());
        })
        .then(done, done);
    });
  }
});
