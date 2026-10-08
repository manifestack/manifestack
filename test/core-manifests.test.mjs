import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manifestKind, manifestDependencies, dependencyMatches, normalizePypi, normalizeSpecifier, stripComments } from '../packages/core/src/manifests.mjs';

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
	for (const f of ['dev-requirements.txt', 'test-requirements.txt', 'requirements-dev.in', 'api/requirements_prod.txt']) assert.equal(manifestKind(f), 'pypi', f);
	assert.equal(manifestKind('constraints.txt'), null);
	assert.equal(manifestKind('supabase/functions/deno.json'), 'npm');
	assert.equal(manifestKind('deno.jsonc'), 'npm');
});

test('pyproject.toml: "]" in extras and a commented-out line do not end or join the array', () => {
	const multi = `[project]
dependencies = [
  "uvicorn[standard]>=0.30",
#  "stripe",
  "sentry-sdk",  # errors ] here
  'openai[datalib]',
]
`;
	assert.deepEqual(manifestDependencies('pypi', multi, 'pyproject.toml'), ['uvicorn', 'sentry-sdk', 'openai']);
	const opening = `[project]
dependencies = ["uvicorn[standard]",
  "stripe>=7",
]
[tool.ruff]
select = ["E"]
`;
	assert.deepEqual(manifestDependencies('pypi', opening, 'pyproject.toml'), ['uvicorn', 'stripe']);
});

test('pyproject.toml: uv and PDM dev dependencies, group includes, multi-line strings', () => {
	const text = `[project]
name = "app"
description = """
[tool.poetry.dependencies]
fake = "1"
"""
optional-dependencies = { ai = ["anthropic"] }

[dependency-groups]
test = ["pytest", {include-group = "lint"}]

[tool.uv]
dev-dependencies = [
  "stripe>=7",
]

[tool.pdm.dev-dependencies]
lint = ["ruff"]
docs = [
  "posthog",
]
`;
	assert.deepEqual(manifestDependencies('pypi', text, 'pyproject.toml'), ['anthropic', 'pytest', 'stripe', 'ruff', 'posthog']);
});

test('a UTF-8 BOM does not hide dependencies', () => {
	assert.deepEqual(manifestDependencies('npm', '\uFEFF{"dependencies":{"stripe":"1"}}', 'package.json'), ['stripe']);
	assert.deepEqual(manifestDependencies('pypi', '\uFEFFstripe==9\n', 'requirements.txt'), ['stripe']);
	assert.deepEqual(manifestDependencies('pypi', '\uFEFF[project]\ndependencies = ["stripe"]\n', 'pyproject.toml'), ['stripe']);
	assert.deepEqual(manifestDependencies('go', '\uFEFFmodule x\nrequire github.com/stripe/stripe-go/v82 v82.0.0\n', 'go.mod'), ['github.com/stripe/stripe-go/v82']);
});

test('package.json: npm aliases count as the package they install', () => {
	const pkg = { dependencies: { 'stripe-legacy': 'npm:stripe@12', 'sb': 'npm:@supabase/supabase-js@^2', react: '19' } };
	assert.deepEqual(manifestDependencies('npm', JSON.stringify(pkg), 'package.json'), ['stripe', '@supabase/supabase-js', 'react']);
});

test('deno.json(c): npm: and jsr: entries of the import map', () => {
	const text = `{
	// comment
	"imports": {
		"stripe": "npm:stripe@14", /* block */
		"@supabase/supabase-js": "jsr:@supabase/supabase-js@2",
		"sub/": "npm:/preact@10/",
		"std/": "https://deno.land/std@0.224.0/",
		"local": "./src/mod.ts",
	},
}`;
	assert.deepEqual(manifestDependencies('npm', text, 'supabase/functions/deno.jsonc'), ['stripe', '@supabase/supabase-js', 'preact']);
});

test('normalizeSpecifier strips registry prefixes and versions, keeps scopes and subpaths', () => {
	assert.equal(normalizeSpecifier('npm:stripe@14'), 'stripe');
	assert.equal(normalizeSpecifier('npm:@supabase/supabase-js@2.45.0'), '@supabase/supabase-js');
	assert.equal(normalizeSpecifier('jsr:@std/assert'), '@std/assert');
	assert.equal(normalizeSpecifier('https://esm.sh/@supabase/supabase-js@2'), '@supabase/supabase-js');
	assert.equal(normalizeSpecifier('https://esm.sh/stripe@14?target=deno'), 'stripe');
	assert.equal(normalizeSpecifier('https://cdn.skypack.dev/firebase@10/auth'), 'firebase/auth');
	assert.equal(normalizeSpecifier('https://esm.run/openai'), 'openai');
	assert.equal(normalizeSpecifier('stripe'), 'stripe');
	assert.equal(normalizeSpecifier('https://example.com/stripe@14'), 'https://example.com/stripe@14');
});

test('stripComments removes // /* */ and # comments but keeps strings', () => {
	const js = `// import a from "@clerk/nextjs"\nconst u = "https://x.dev//a"; /* import "b" */ const t = \`// \${x}\`; const re = /^https?:\\/\\//;\nimport c from 'c'`;
	const out = stripComments(js);
	assert.ok(!out.includes('@clerk/nextjs') && !out.includes('import "b"'));
	assert.ok(out.includes('"https://x.dev//a"') && out.includes('`// ${x}`') && out.includes("import c from 'c'"));
	const py = `# supabase.auth.sign_in\nurl = "https://x#y"  # comment\ns = """\n# kept\n"""\n`;
	const pyOut = stripComments(py, { hash: true });
	assert.ok(!pyOut.includes('supabase.auth') && !pyOut.includes('comment'));
	assert.ok(pyOut.includes('"https://x#y"') && pyOut.includes('# kept'));
});

test('requirements.txt: names with extras, pins and markers, #egg= names; options, URLs and paths skipped', () => {
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
	assert.deepEqual(manifestDependencies('pypi', text, 'requirements.txt'), ['stripe', 'openai', 'Sentry_SDK', 'y', 'anthropic']);
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
