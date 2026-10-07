// Minimal YAML reader for vendor-map frontmatter. Covers what catalog/vendors/*.md uses:
// nested maps by indentation, block lists, lists of maps, inline [a, "b"] lists, quoted and plain
// scalars, numbers, booleans, null and `#` comments. Not a general YAML parser.

export function parseFrontmatter(text) {
	const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/.exec(text);
	if (!m) return { data: {}, body: text };
	return { data: parseYaml(m[1]), body: m[2] };
}

export function parseYaml(src) {
	const lines = [];
	for (const raw of src.split(/\r?\n/)) {
		if (raw.includes('\t') && /^\s*\t/.test(raw)) throw new Error('YAML: tabs are not allowed for indentation');
		const text = stripYamlComment(raw).replace(/\s+$/, '');
		if (!text.trim()) continue;
		lines.push({ indent: text.length - text.trimStart().length, text: text.trim() });
	}
	let i = 0;
	const isItem = (t) => t === '-' || t.startsWith('- ');

	function parseBlock() {
		return isItem(lines[i].text) ? parseList(lines[i].indent) : parseMap(lines[i].indent);
	}

	function parseList(indent) {
		const out = [];
		while (i < lines.length && lines[i].indent === indent && isItem(lines[i].text)) {
			const rest = lines[i].text.slice(1).trim();
			if (!rest) {
				i++;
				out.push(i < lines.length && lines[i].indent > indent ? parseBlock() : null);
			} else if (!/^["'[{]/.test(rest) && splitYamlKey(rest)) {
				// A map item: its first key sits on the dash line, the rest are indented under it.
				lines[i] = { indent: indent + 2, text: rest };
				out.push(parseMap(indent + 2));
			} else {
				i++;
				out.push(parseYamlScalar(rest));
			}
		}
		return out;
	}

	function parseMap(indent) {
		const out = {};
		while (i < lines.length && lines[i].indent === indent && !isItem(lines[i].text)) {
			const kv = splitYamlKey(lines[i].text);
			if (!kv) throw new Error(`YAML: cannot parse line "${lines[i].text}"`);
			i++;
			const [key, value] = kv;
			if (value !== '') out[key] = parseYamlScalar(value);
			else if (i < lines.length && (lines[i].indent > indent || (lines[i].indent === indent && isItem(lines[i].text)))) out[key] = parseBlock();
			else out[key] = null;
		}
		if (i < lines.length && lines[i].indent > indent) throw new Error(`YAML: unexpected indentation at "${lines[i].text}"`);
		return out;
	}

	if (!lines.length) return {};
	const result = parseBlock();
	if (i < lines.length) throw new Error(`YAML: unexpected content at "${lines[i].text}"`);
	return result;
}

function stripYamlComment(line) {
	let quote = null;
	for (let k = 0; k < line.length; k++) {
		const c = line[k];
		if (quote) {
			if (c === '\\' && quote === '"') k++;
			else if (c === quote) quote = null;
		} else if (c === '"' || c === "'") {
			quote = c;
		} else if (c === '#' && (k === 0 || /\s/.test(line[k - 1]))) {
			return line.slice(0, k);
		}
	}
	return line;
}

function splitYamlKey(text) {
	const m = /^("[^"]*"|'[^']*'|[A-Za-z0-9_][A-Za-z0-9_.\-]*)\s*:(?:\s+(.*))?$/.exec(text);
	if (!m) return null;
	return [m[1].replace(/^["']|["']$/g, ''), (m[2] ?? '').trim()];
}

export function parseYamlScalar(raw) {
	const s = raw.trim();
	if (s.startsWith('"')) return JSON.parse(s);
	if (s.startsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
	if (s.startsWith('[')) {
		if (!s.endsWith(']')) throw new Error(`YAML: unterminated list ${s}`);
		return splitInline(s.slice(1, -1)).map(parseYamlScalar);
	}
	if (s.startsWith('{')) {
		if (!s.endsWith('}')) throw new Error(`YAML: unterminated map ${s}`);
		const out = {};
		for (const part of splitInline(s.slice(1, -1))) {
			const kv = splitYamlKey(part);
			if (!kv) throw new Error(`YAML: cannot parse map entry ${part}`);
			out[kv[0]] = parseYamlScalar(kv[1]);
		}
		return out;
	}
	if (s === 'true') return true;
	if (s === 'false') return false;
	if (s === 'null' || s === '~') return null;
	if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
	return s;
}

function splitInline(s) {
	const parts = [];
	let cur = '';
	let quote = null;
	let depth = 0;
	for (let k = 0; k < s.length; k++) {
		const c = s[k];
		if (quote) {
			cur += c;
			if (c === '\\' && quote === '"') cur += s[++k] ?? '';
			else if (c === quote) quote = null;
		} else if (c === '"' || c === "'") {
			quote = c;
			cur += c;
		} else if (c === '[' || c === '{') {
			depth++;
			cur += c;
		} else if (c === ']' || c === '}') {
			depth--;
			cur += c;
		} else if (c === ',' && depth === 0) {
			parts.push(cur);
			cur = '';
		} else {
			cur += c;
		}
	}
	if (cur.trim()) parts.push(cur);
	return parts.map((p) => p.trim()).filter(Boolean);
}
