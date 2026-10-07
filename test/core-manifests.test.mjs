import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manifestKind, manifestDependencies, dependencyMatches, normalizePypi } from '../packages/core/src/manifests.mjs';

test('manifestKind recognizes npm, PyPI and Go manifests', () => {
	assert.equal(manifestKind('package.json'), 'npm');
	assert.equal(manifestKind('apps/web/package.json'), 'npm');
	assert.equal(manifestKind('requirements.txt'), 'pypi');
	assert.equal(manifestKind('requirements-dev.txt'), 'pypi');
	assert.equal(manifestKind('requirements/prod.txt'), 'pypi');
	assert.equal(manifestKind('requirements.in'), 'pypi');
	assert.equal(manifestKind('backend/pyproject.toml'), 'pypi');
	assert.equal(manifestKind('Pipfile'), 'pypi');
	assert.equal(manifestKind('go.mod'), 'go');
	assert.equal(manifestKind('notes.txt'), null);
	assert.equal(manifestKind('go.sum'), null);
});

test('requirements.txt: names with extras, pins and markers; options, URLs and paths skipped', () => {
	const text = `# comment
stripe==9.1.0
openai[datalib]>=1.40  # inline comment
Sentry_SDK ; python_version >= "3.9"
-r base.txt
-e git+https://github.com/x/y.git#egg=y
./local-package
https://example.com/pkg.whl
anthropic @ https://example.com/anthropic.whl
`;
	assert.deepEqual(manifestDependencies('pypi', text, 'requirements.txt'), ['stripe', 'openai', 'Sentry_SDK', 'anthropic']);
});

test('pyproject.toml: PEP 621, optional dependencies, dependency groups and Poetry', () => {
	const text = `[project]
name = "app"
dependencies = [
  "fastapi>=0.110",
  "stripe[async]",  # payments
]

[project.optional-dependencies]
ai = ["openai>=1", 'anthropic']

[dependency-groups]
dev = ["pytest"]

[tool.poetry.dependencies]
python = "^3.12"
sentry-sdk = "^2"

[tool.poetry.group.dev.dependencies]
ruff = "*"

[tool.ruff]
line-length = 100
`;
	assert.deepEqual(manifestDependencies('pypi', text, 'pyproject.toml'), ['fastapi', 'stripe', 'openai', 'anthropic', 'pytest', 'sentry-sdk', 'ruff']);
});

test('Pipfile: packages and dev-packages', () => {
	const text = `[[source]]
url = "https://pypi.org/simple"

[packages]
django = "*"
"posthog" = ">=3"

[dev-packages]
black = "*"

[requires]
python_version = "3.12"
`;
	assert.deepEqual(manifestDependencies('pypi', text, 'Pipfile'), ['django', 'posthog', 'black']);
});

test('go.mod: require lines and blocks, indirect deps left out', () => {
	const text = `module example.com/app

go 1.23

require github.com/gin-gonic/gin v1.10.0

require (
	github.com/stripe/stripe-go/v82 v82.0.0
	github.com/getsentry/sentry-go v0.30.0 // comment
	golang.org/x/net v0.30.0 // indirect
)
`;
	assert.deepEqual(manifestDependencies('go', text, 'go.mod'), ['github.com/gin-gonic/gin', 'github.com/stripe/stripe-go/v82', 'github.com/getsentry/sentry-go']);
});

test('broken manifests give no dependencies instead of throwing', () => {
	assert.deepEqual(manifestDependencies('npm', '{ broken', 'package.json'), []);
	assert.deepEqual(manifestDependencies('pypi', '', 'requirements.txt'), []);
});

test('dependencyMatches follows each ecosystem naming rule', () => {
	assert.equal(normalizePypi('Sentry_SDK'), 'sentry-sdk');
	assert.ok(dependencyMatches('pypi', 'Sentry_SDK', ['sentry-sdk']));
	assert.ok(dependencyMatches('pypi', 'google.cloud.storage', ['google-cloud-*']));
	assert.ok(!dependencyMatches('pypi', 'stripe-mock', ['stripe']));
	assert.ok(dependencyMatches('go', 'github.com/stripe/stripe-go/v82', ['github.com/stripe/stripe-go']));
	assert.ok(!dependencyMatches('go', 'github.com/stripe/stripe-gomock', ['github.com/stripe/stripe-go']));
	assert.ok(dependencyMatches('npm', '@stripe/stripe-js', ['@stripe/']));
	assert.ok(!dependencyMatches('npm', 'stripe', []));
});
