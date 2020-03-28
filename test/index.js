'use strict'

const test = require('tap').test
const sinon = require('sinon')
const lifecycle = require('../index.js')
const path = require('path')

function noop () {}

test('makeEnv', function (t) {
  const pkg = {
    name: 'myPackage',
    version: '1.0.0',
    contributors: [{ name: 'Mike Sherov', email: 'beep@boop.com' }]
  }
  const config = {
    enteente: Infinity,
    '_privateVar': 1,
    '_myPackage:myPrivateVar': 1,
    'myPackage:bar': 2,
    'myPackage:foo': 3,
    'myPackage@1.0.0:baz': 4,
    'myPackage@1.0.0:foo': 5,
    ignoreThisFunction: () => {},
    jsonsAsUndefined: { toJSON: () => undefined },
    jsonsAsFunction: { toJSON: () => () => {} }
  }

  const env = lifecycle.makeEnv(pkg, {
    config,
    nodeOptions: '--inspect-brk --abort-on-uncaught-exception',
    env: {
      npm_lifecycle_var1: '6',
      npm_lifecycle_var2: 7,
      npm_lifecycle_ignored_null: null,
      npm_lifecycle_ignored_object: { name: '8' },
      npm_lifecycle_ignored_array: [ 10, 11 ]
    }
  }, null, Object.assign({}, process.env))

  t.equal('myPackage', env.npm_package_name, 'package data is included')
  t.equal('Mike Sherov', env.npm_package_contributors_0_name, 'nested package data is included')

  t.equal('Infinity', env.npm_config_enteente, 'public config is included')
  t.equal(undefined, env.npm_config_privateVar, 'private config is excluded')

  t.equal('1', env.npm_config_myPackage_myPrivateVar, 'private package config is included by name')
  t.equal('2', env.npm_config_myPackage_bar, 'public package config is included by name')

  t.equal('5', env.npm_config_myPackage_1_0_0_foo, 'public package@version config is included by name')

  t.equal('1', env.npm_package_config_myPrivateVar, 'package private config is included')
  t.equal('2', env.npm_package_config_bar, 'package config is included')
  t.equal('4', env.npm_package_config_baz, 'package@version config is included')
  t.equal('5', env.npm_package_config_foo, 'package@version config overrides package config')
  t.equal('6', env.npm_lifecycle_var1, 'env string option is included')
  t.equal('7', env.npm_lifecycle_var2, 'env number option is included')
  t.equal(undefined, env.npm_lifecycle_ignored_null, 'env null options are ignored')
  t.equal(undefined, env.npm_lifecycle_ignored_object, 'env object options are ignored')
  t.equal(undefined, env.npm_lifecycle_ignored_array, 'env array options are ignored')

  t.equal(env.npm_package_config_ignoreThisFunction, undefined)
  t.equal(env.npm_package_config_jsonsAsUndefined, undefined)
  t.equal(env.npm_package_config_jsonsAsFunction, undefined)

  t.equal('--inspect-brk --abort-on-uncaught-exception', env.NODE_OPTIONS, 'nodeOptions sets NODE_OPTIONS')
  t.end()
})

test('_incorrectWorkingDirectory: accepts wd for package that matches project\'s name', function (t) {
  const wd = '/opt/my-time/node_modules/time'
  const pkg = { name: 'time' }

  t.equal(lifecycle._incorrectWorkingDirectory(wd, pkg), false)
  t.end()
})

test('_incorrectWorkingDirectory: accepts wd for package that doesn\'t match project\'s name', function (t) {
  const wd = '/opt/my-project/node_modules/time'
  const pkg = { name: 'time' }

  t.equal(lifecycle._incorrectWorkingDirectory(wd, pkg), false)
  t.end()
})

test('_incorrectWorkingDirectory: rejects wd from other packages', function (t) {
  const wd = '/opt/my-time/node_modules/time/invalid'
  const pkg = {
    name: 'time'
  }

  t.equal(lifecycle._incorrectWorkingDirectory(wd, pkg), true)
  t.end()
})

test('runs scripts from .hooks directory even if no script is present in package.json', function (t) {
  const fixture = path.join(__dirname, 'fixtures', 'has-hooks')

  const verbose = sinon.spy()
  const silly = sinon.spy()
  const log = {
    level: 'silent',
    info: noop,
    warn: noop,
    silly,
    verbose,
    pause: noop,
    resume: noop,
    clearProgress: noop,
    showProgress: noop
  }
  const dir = path.join(fixture, 'node_modules')

  const pkg = require(path.join(fixture, 'package.json'))

  lifecycle(pkg, 'postinstall', fixture, {
    stdio: 'pipe',
    log,
    dir,
    config: {}
  })
    .then(() => {
      t.ok(
        verbose.calledWithMatch(
          'lifecycle',
          'undefined~postinstall:',
          'stdout',
          'ran hook'
        ),
        'ran postinstall hook'
      )

      t.end()
    })
    .catch(t.end)
})

test("reports child's output", function (t) {
  const fixture = path.join(__dirname, 'fixtures', 'count-to-10')

  const verbose = sinon.spy()
  const silly = sinon.spy()
  const log = {
    level: 'silent',
    info: noop,
    warn: noop,
    silly,
    verbose,
    pause: noop,
    resume: noop,
    clearProgress: noop,
    showProgress: noop
  }
  const dir = path.join(__dirname, '..')

  const pkg = require(path.join(fixture, 'package.json'))

  lifecycle(pkg, 'postinstall', fixture, {
    stdio: 'pipe',
    log,
    dir,
    config: {}
  })
    .then(() => {
      t.ok(
        verbose.calledWithMatch(
          'lifecycle',
          'undefined~postinstall:',
          'stdout',
          'line 1'
        ),
        'stdout reported'
      )
      t.ok(
        verbose.calledWithMatch(
          'lifecycle',
          'undefined~postinstall:',
          'stdout',
          'line 2'
        ),
        'stdout reported'
      )
      t.ok(
        verbose.calledWithMatch(
          'lifecycle',
          'undefined~postinstall:',
          'stderr',
          'some error'
        ),
        'stderr reported'
      )
      t.ok(
        silly.calledWithMatch(
          'lifecycle',
          'undefined~postinstall:',
          'Returned: code:',
          0,
          ' signal:',
          null
        ),
        'exit code reported'
      )

      t.end()
    })
    .catch(t.end)
})

test('fails when given an invalid user id', {
  skip: process.platform === 'win32' ? 'windows always in unsafe mode' : false
}, function (t) {
  const fixture = path.join(__dirname, 'fixtures', 'count-to-10-working-postinstall')
  const dir = fixture

  const pkg = require(path.join(fixture, 'package.json'))
  t.rejects(lifecycle(pkg, 'postinstall', fixture, {
    stdio: 'pipe',
    log: {
      level: 'silent',
      info: noop,
      warn: noop,
      silly: noop,
      verbose: noop,
      pause: noop,
      resume: noop,
      clearProgress: noop,
      showProgress: noop
    },
    dir,
    user: 'this-user-name-does-not-exist-at-least-i-sure-hope-not',
    group: 'maybe-there-are-a-bunch-of-us-who-do-not-exist',
    unsafePerm: false,
    config: {}
  }), { code: 'EUIDLOOKUP' })
  t.end()
})
