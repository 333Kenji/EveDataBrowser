import fs from 'node:fs';
import { buildTaxonomyCategories } from '../src/services/taxonomy-service.js';

const atrRaw = JSON.parse(fs.readFileSync(new URL('../test-results/e2e-dropdown-search-dropdo-6255a--and-shortlist-interactions-chromium/trace/resources/9d4162504141b19af8b5f8da4c6dd67a2feb7d40.json', import.meta.url), 'utf8'));
const rootRaw = JSON.parse(fs.readFileSync(new URL('../test-results/e2e-dropdown-search-dropdo-6255a--and-shortlist-interactions-chromium/trace/resources/5b66689bd6cfa7f508c94c6bf0f21650b2c958c4.json', import.meta.url), 'utf8'));

const atrCategories = buildTaxonomyCategories(atrRaw.actions[0].inputs[0].body.items);
const rootCategories = buildTaxonomyCategories(rootRaw.actions[0].inputs[0].body.items);

console.log('root categories', rootCategories.map((category) => ({ name: category.name, typeCount: category.typeCount })));
console.log('atr categories', atrCategories.map((category) => ({ name: category.name, typeCount: category.typeCount })));
console.log('atr first category groups', atrCategories[0]?.groups.map((group) => ({ name: group.name, types: group.types.map((type) => type.name) })));
