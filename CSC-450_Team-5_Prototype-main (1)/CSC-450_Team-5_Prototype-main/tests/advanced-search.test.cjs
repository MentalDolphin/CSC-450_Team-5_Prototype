const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const elements = new Map();
function element() {
    return { value: '', textContent: '', hidden: true, children: [], attrs: {}, events: {},
        set innerHTML(value) { throw new Error('Unsafe HTML sink'); },
        setAttribute(k,v) { this.attrs[k]=v; }, removeAttribute(k) { delete this.attrs[k]; },
        addEventListener(k,v) { this.events[k]=v; }, focus() { this.focused=true; },
        append(...nodes) { this.children.push(...nodes); }, appendChild(node) { this.children.push(node); },
        replaceChildren() { this.children=[]; }
    };
}
const context = vm.createContext({document: {
    getElementById(id) { if (!elements.has(id)) elements.set(id,element()); return elements.get(id); },
    createElement: element
}, localStorage: {getItem() {return null;}}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../RecipeVault_1st/script.js'),'utf8'), context);
const run = code => vm.runInContext(code,context);
let passed=0;
function test(name,fn) {fn(); passed++; console.log('PASS '+name);}
const input=elements.get('advancedIngredients');
function search(value) {input.value=value; run('searchByIngredients({preventDefault(){}})');}
test('comma/newline, case, whitespace and duplicates',()=>assert.equal(run('JSON.stringify(parseIngredientSearch(" Chicken, lemon\\nCHICKEN, olive   oil,"))'),'["chicken","lemon","olive oil"]'));
test('all ingredients match',()=>{search('chicken,lemon,olive oil'); assert.equal(elements.get('recipeCount').textContent,'1 recipe(s) found.');});
test('one absent ingredient excludes recipe',()=>{search('chicken,milk');assert.equal(elements.get('recipeCount').textContent,'0 recipe(s) found.');});
test('ingredient-only matching excludes titles',()=>{search('weekend');assert.equal(elements.get('recipeCount').textContent,'0 recipe(s) found.');});
test('partial ingredient matching',()=>{search('tomato,basil');assert.equal(elements.get('recipeCount').textContent,'1 recipe(s) found.');});
test('empty and separator-only rejected',()=>{for(const v of ['', ' ,\n, ']) assert.throws(()=>run(`parseIngredientSearch(${JSON.stringify(v)})`));});
test('length and count limits',()=>{for(const v of ['a'.repeat(1001),'a'.repeat(61),Array(21).fill('a').join(',')]) assert.throws(()=>run(`parseIngredientSearch(${JSON.stringify(v)})`));});
test('common ingredient punctuation and Unicode accepted',()=>assert.equal(run('parseIngredientSearch("baker\'s yeast, crème fraîche, gluten-free flour, milk (2%)").length'),4));
test('XSS payload rejected and error displayed as text',()=>{search('<img src=x onerror=alert(1)>');assert.equal(input.attrs['aria-invalid'],'true');assert.ok(elements.get('advancedSearchError').textContent);});
test('SQL-shaped text is literal and cannot broaden results',()=>{search("chicken' OR '1'='1");assert.equal(input.attrs['aria-invalid'],'true');search("chicken' OR 'one");assert.equal(elements.get('recipeCount').textContent,'0 recipe(s) found.');});
test('private recipes owned by others remain excluded',()=>{run('recipes.push({...sampleRecipes[0], id:"secret", author:"other", visibility:"private"})');search('chicken,lemon');assert.equal(elements.get('recipeCount').textContent,'1 recipe(s) found.');});
test('My Recipes scope retained',()=>{run('openRecipeList(true)');search('tomato,basil');assert.equal(elements.get('recipeCount').textContent,'0 recipe(s) found.');});
test('toggle exposes panel and focuses field',()=>{elements.get('advancedSearchButton').events.click();assert.equal(elements.get('advancedSearchPanel').hidden,false);assert.equal(elements.get('advancedSearchButton').attrs['aria-expanded'],'true');assert.ok(input.focused);});
test('basic search still works and clears advanced state',()=>{run('openRecipeList(false)');elements.get('searchInput').value='Lemon';run('searchRecipes({preventDefault(){}})');assert.equal(elements.get('recipeCount').textContent,'1 recipe(s) found.');assert.equal(input.value,'');});
test('clear resets results, error and focus',()=>{search('<script>');elements.get('clearAdvancedSearchButton').events.click();assert.equal(elements.get('recipeCount').textContent,'3 recipe(s) found.');assert.equal(elements.get('advancedSearchError').textContent,'');assert.ok(elements.get('advancedSearchButton').focused);});
console.log(`${passed} tests passed.`);
