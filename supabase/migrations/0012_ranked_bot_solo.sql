-- Ranked bot matches follow the solo phases, and the server scores with the same rules.
-- A bot match lets the player fill a whole round before the bot answers, then
-- discard, round 2, swap, and silver. engine_score applies powers, combos,
-- knockouts, silver, swap penalty, and goal colors.
-- Do not apply from the client. Review this file, then run it in the Supabase SQL editor.

create table if not exists public.card_rules (
  id text primary key,
  char_name text not null default '',
  grp text not null default '',
  archetype text not null default '',
  features text[] not null default '{}',
  powers jsonb not null default '[]'::jsonb,
  wild boolean not null default false
);
create table if not exists public.combo_pairs (
  id text primary key,
  name text not null,
  a text not null,
  b text not null,
  bonus int not null
);
create table if not exists public.combo_sets (
  id text primary key,
  name text not null,
  bonus int not null,
  ids text[] not null
);
insert into public.card_rules (id, char_name, grp, archetype, features, powers, wild) values
('zoomer', 'Zoomer', 'Galaxy Gang', 'Galaxy', array['Male','Hero']::text[], '[]'::jsonb, false),
('zoomer_jet', 'Zoomer', 'Galaxy Gang', 'Galaxy', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"feature":"Hero"}}]'::jsonb, false),
('nell', 'Nell', 'Galaxy Gang', 'Galaxy', array['Female','Hero']::text[], '[]'::jsonb, false),
('bleep', 'Bleep', 'Galaxy Gang', 'Galaxy', array['Prop']::text[], '[{"type":"boost","op":"add","n":3,"who":"allOther","filter":{"group":"Galaxy Gang"}},{"type":"tag","who":"neighbors","archetype":"Robots"}]'::jsonb, false),
('gravitron', 'Gravitron', 'Galaxy Gang', 'Galaxy', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":-5,"who":"opposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('astropup', 'Astro Pup', 'Galaxy Gang', 'Galaxy', array['Animal']::text[], '[{"type":"boost","op":"mul","n":3,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Zoomer"}}}]'::jsonb, false),
('starhopper', 'Starhopper', 'Galaxy Gang', 'Galaxy', array['Vehicle']::text[], '[]'::jsonb, false),
('lunara', 'Lunara', 'Galaxy Gang', 'Galaxy', array['Female','Villain']::text[], '[{"type":"boost","op":"add","n":10,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Gravitron"}}}]'::jsonb, false),
('cometkid', 'Comet Kid', 'Galaxy Gang', 'Galaxy', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"where":"inPlay","filter":{"feature":"Hero"}}}]'::jsonb, false),
('gloop', 'Gloop', 'Spooky Hollow', 'Spooks', array['Monster']::text[], '[]'::jsonb, false),
('fangly', 'Fangly', 'Spooky Hollow', 'Spooks', array['Male','Villain','Monster']::text[], '[{"type":"boost","op":"add","n":5,"who":"self","cond":{"kind":"inPlay","filter":{"char":"Bertha"}}}]'::jsonb, false),
('bertha', 'Bertha', 'Spooky Hollow', 'Spooks', array['Female','Monster','Animal']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"feature":"Monster"}}}]'::jsonb, false),
('wisp', 'Wanda', 'Spooky Hollow', 'Spooks', array['Female','Monster']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","each":{"where":"neighbors","filter":{"color":"purple"}}}]'::jsonb, false),
('manor', 'Hollow Manor', 'Spooky Hollow', 'Spooks', array['Place']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"feature":"Monster"}}]'::jsonb, false),
('bonesy', 'Bonesy', 'Spooky Hollow', 'Spooks', array['Male','Monster']::text[], '[]'::jsonb, false),
('timid', 'Tim', 'Spooky Hollow', 'Spooks', array['Male']::text[], '[{"type":"boost","op":"add","n":-2,"who":"all","filter":{"feature":"Monster"}}]'::jsonb, false),
('pumpkin', 'Pete', 'Spooky Hollow', 'Spooks', array['Male','Villain']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Hollow Manor"}}}]'::jsonb, false),
('hank', 'Hank', 'Barnyard Bonkers', 'Barnyard', array['Male','Animal']::text[], '[]'::jsonb, false),
('hank_mud', 'Hank', 'Barnyard Bonkers', 'Barnyard', array['Male','Animal']::text[], '[{"type":"boost","op":"add","n":5,"who":"neighbors","filter":{"feature":"Animal"}}]'::jsonb, false),
('clara', 'Clara', 'Barnyard Bonkers', 'Barnyard', array['Female','Animal']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"yellow"}}]'::jsonb, false),
('moomax', 'Max', 'Barnyard Bonkers', 'Barnyard', array['Male','Animal']::text[], '[]'::jsonb, false),
('fritz', 'Fritz', 'Barnyard Bonkers', 'Barnyard', array['Male']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"color":"green"}}]'::jsonb, false),
('tractor', 'Rusty', 'Barnyard Bonkers', 'Barnyard', array['Vehicle','Prop']::text[], '[{"type":"boost","op":"add","n":10,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Fritz"}}}]'::jsonb, false),
('quack', 'Quacksalot', 'Barnyard Bonkers', 'Barnyard', array['Male','Animal','Hero']::text[], '[]'::jsonb, false),
('weasel', 'Weasel', 'Barnyard Bonkers', 'Barnyard', array['Male','Villain','Animal']::text[], '[{"type":"boost","op":"add","n":-3,"who":"neighborsOrOpposite","filter":{"feature":"Animal"}}]'::jsonb, false),
('granny', 'Granny', 'Barnyard Bonkers', 'Barnyard', array['Female','Animal']::text[], '[{"type":"boost","op":"add","n":1,"who":"all","filter":{"feature":"Female"}}]'::jsonb, false),
('pip', 'Pip', 'Sprout Squad', 'Sprouts', array['Male','Hero']::text[], '[]'::jsonb, false),
('pip_armor', 'Pip', 'Sprout Squad', 'Sprouts', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"feature":"Hero"}}]'::jsonb, false),
('daisy', 'Daisy', 'Sprout Squad', 'Sprouts', array['Female','Hero']::text[], '[{"type":"boost","op":"add","n":2,"who":"allOther","filter":{"group":"Sprout Squad"}}]'::jsonb, false),
('thorn', 'Thorn', 'Sprout Squad', 'Sprouts', array['Male','Villain']::text[], '[]'::jsonb, false),
('weedwhack', 'Weedwhacker', 'Sprout Squad', 'Sprouts', array['Villain','Prop']::text[], '[{"type":"boost","op":"add","n":-2,"who":"all","filter":{"color":"green"}}]'::jsonb, false),
('treehouse', 'Treehouse HQ', 'Sprout Squad', 'Sprouts', array['Place']::text[], '[{"type":"boost","op":"add","n":2,"who":"allOther","filter":{"group":"Sprout Squad"}}]'::jsonb, false),
('bud', 'Bud', 'Sprout Squad', 'Sprouts', array['Male','Hero']::text[], '[{"type":"recolor","color":"red","who":"neighbors"},{"type":"tag","who":"neighbors","archetype":"Fairies"}]'::jsonb, false),
('mossy', 'Mossy', 'Sprout Squad', 'Sprouts', array['Animal']::text[], '[{"type":"boost","op":"mul","n":2,"who":"all","filter":{"char":"Pip"}}]'::jsonb, false),
('petal', 'Petal', 'Sprout Squad', 'Sprouts', array['Female','Hero']::text[], '[]'::jsonb, false),
('mayor', 'Bigsby', 'Toonville', 'Toons', array['Male']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"distinct":"archetype","where":"ownSide"}}]'::jsonb, false),
('dj', 'Zigzag', 'Toonville', 'Toons', array['Male']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"color":"blue"}}]'::jsonb, false),
('rosie', 'Rosie', 'Toonville', 'Toons', array['Female','Prop']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"feature":"Prop"}}}]'::jsonb, false),
('sneak', 'Sneak', 'Toonville', 'Toons', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":-1,"who":"all","filter":{"feature":"Male"}}]'::jsonb, false),
('mel', 'Mel', 'Toonville', 'Toons', array['Female']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"purple"}}]'::jsonb, false),
('zap', 'Zap', 'Toonville', 'Toons', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Nell"}}}]'::jsonb, false),
('blaze', 'Blaze', 'Toonville', 'Toons', array['Female']::text[], '[]'::jsonb, false),
('ember', 'Ember', 'Dragon Roost', 'Dragons', array['Male','Monster']::text[], '[]'::jsonb, false),
('glimmer', 'Glimmerscale', 'Dragon Roost', 'Dragons', array['Female','Monster']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Dragon Roost"}}}]'::jsonb, false),
('mossfang', 'Mossfang', 'Dragon Roost', 'Dragons', array['Male','Monster']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","cond":{"kind":"opposite","filter":{"archetype":"Knights"}}}]'::jsonb, false),
('grandwyrm', 'Wyrm', 'Dragon Roost', 'Dragons', array['Female','Monster']::text[], '[{"type":"boost","op":"add","n":3,"who":"allOther","filter":{"group":"Dragon Roost"}}]'::jsonb, false),
('ember_egg', 'Ember', 'Dragon Roost', 'Dragons', array['Male','Monster']::text[], '[{"type":"boost","op":"mul","n":3,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Wyrm"}}}]'::jsonb, false),
('cinderpuff', 'Cinderpuff', 'Dragon Roost', 'Dragons', array['Monster']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"red"}}]'::jsonb, false),
('volcanolair', 'Volcano Lair', 'Dragon Roost', 'Dragons', array['Place']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Dragon Roost"}}]'::jsonb, false),
('skyrider', 'Zephyr', 'Dragon Roost', 'Dragons', array['Male','Hero','Monster']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"feature":"Hero"}}]'::jsonb, false),
('hoardle', 'Hoardle', 'Dragon Roost', 'Dragons', array['Male','Villain','Monster']::text[], '[{"type":"boost","op":"add","n":-2,"who":"all","filter":{"group":"Brave Brigade"}}]'::jsonb, false),
('frostwing', 'Frostwing', 'Dragon Roost', 'Dragons', array['Female','Monster']::text[], '[{"type":"recolor","color":"blue","who":"neighbors"}]'::jsonb, false),
('zigzag_dr', 'Ziggle Zaggle', 'Dragon Roost', 'Dragons', array['Male','Monster']::text[], '[]'::jsonb, false),
('sparkler', 'Sparkler', 'Dragon Roost', 'Dragons', array['Female','Monster']::text[], '[{"type":"boost","op":"add","n":3,"who":"self","each":{"where":"neighbors","filter":{"color":"red"}}}]'::jsonb, false),
('magmaw', 'Magmaw', 'Dragon Roost', 'Dragons', array['Male','Villain','Monster']::text[], '[{"type":"boost","op":"add","n":-4,"who":"opposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('noodle', 'Noodle', 'Dragon Roost', 'Dragons', array['Male','Monster']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"group":"Dragon Roost"}}}]'::jsonb, false),
('twinkle', 'Twinkle', 'Pixie Glen', 'Fairies', array['Female','Hero']::text[], '[]'::jsonb, false),
('dewdrop', 'Dewdrop', 'Pixie Glen', 'Fairies', array['Female']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Pixie Glen"}}}]'::jsonb, false),
('thistle', 'Thistle', 'Pixie Glen', 'Fairies', array['Male','Hero']::text[], '[]'::jsonb, false),
('mushmum', 'Mushcap', 'Pixie Glen', 'Fairies', array['Female']::text[], '[{"type":"boost","op":"add","n":3,"who":"allOther","filter":{"group":"Pixie Glen"}}]'::jsonb, false),
('glowbug', 'Gus', 'Pixie Glen', 'Fairies', array['Male','Animal']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"purple"}}]'::jsonb, false),
('fairyring', 'Fairy Ring', 'Pixie Glen', 'Fairies', array['Place']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Pixie Glen"}}]'::jsonb, false),
('nettle', 'Nettle', 'Pixie Glen', 'Fairies', array['Female','Villain']::text[], '[{"type":"boost","op":"add","n":-4,"who":"opposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('twinkle_moon', 'Twinkle', 'Pixie Glen', 'Fairies', array['Female','Hero']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"group":"Pixie Glen"}}}]'::jsonb, false),
('pollen', 'Pollen', 'Pixie Glen', 'Fairies', array['Female']::text[], '[{"type":"recolor","color":"yellow","who":"neighbors"}]'::jsonb, false),
('bloomer', 'Bloomer', 'Pixie Glen', 'Fairies', array['Female']::text[], '[]'::jsonb, false),
('pinecone', 'Pinecone', 'Pixie Glen', 'Fairies', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"feature":"Female"}}]'::jsonb, false),
('duskwing', 'Dora', 'Pixie Glen', 'Fairies', array['Female']::text[], '[{"type":"boost","op":"add","n":3,"who":"self","each":{"where":"neighbors","filter":{"color":"purple"}}}]'::jsonb, false),
('rainbow_sp', 'Prism', 'Pixie Glen', 'Fairies', array['Female']::text[], '[]'::jsonb, false),
('sprigsnatch', 'Sprig Snatcher', 'Pixie Glen', 'Fairies', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":-2,"who":"all","filter":{"group":"Sweet Tooth Town"}}]'::jsonb, false),
('sirbumble', 'Bumbleby', 'Brave Brigade', 'Knights', array['Male','Hero']::text[], '[]'::jsonb, false),
('dame_dash', 'Dashwell', 'Brave Brigade', 'Knights', array['Female','Hero']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Brave Brigade"}}}]'::jsonb, false),
('squire', 'Scoot', 'Brave Brigade', 'Knights', array['Male']::text[], '[{"type":"boost","op":"add","n":8,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Bumbleby"}}}]'::jsonb, false),
('shieldwall', 'Shieldwall', 'Brave Brigade', 'Knights', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":3,"who":"allOther","filter":{"group":"Brave Brigade"}},{"type":"boost","op":"add","n":5,"who":"self","cond":{"kind":"pure"}}]'::jsonb, false),
('trotter', 'Trotter', 'Brave Brigade', 'Knights', array['Animal']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Bumbleby"}}}]'::jsonb, false),
('castle', 'Castle Crumbleton', 'Brave Brigade', 'Knights', array['Place']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Brave Brigade"}}]'::jsonb, false),
('blackvisor', 'Black Visor', 'Brave Brigade', 'Knights', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":-4,"who":"opposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('sirbumble_dr', 'Bumbleby', 'Brave Brigade', 'Knights', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":-2,"who":"all","filter":{"group":"Dragon Roost"}}]'::jsonb, false),
('axel', 'Axel', 'Brave Brigade', 'Knights', array['Male','Hero']::text[], '[]'::jsonb, false),
('valkyra', 'Valkyra', 'Brave Brigade', 'Knights', array['Female','Hero']::text[], '[]'::jsonb, false),
('bannerboy', 'Benny', 'Brave Brigade', 'Knights', array['Male']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"blue"}}]'::jsonb, false),
('jester', 'Jangles', 'Brave Brigade', 'Knights', array['Male']::text[], '[{"type":"recolor","color":"yellow","who":"neighbors"}]'::jsonb, false),
('gallant', 'Gwen', 'Brave Brigade', 'Knights', array['Female','Hero']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"feature":"Hero"}}]'::jsonb, false),
('rustbucket', 'Rustbucket', 'Brave Brigade', 'Knights', array['Male']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"where":"inPlay","filter":{"feature":"Hero"}}}]'::jsonb, false),
('fizzwick', 'Fizzwick', 'Spellbound Academy', 'Wizards', array['Male','Hero']::text[], '[]'::jsonb, false),
('madame_m', 'Moonquill', 'Spellbound Academy', 'Wizards', array['Female']::text[], '[{"type":"boost","op":"add","n":3,"who":"allOther","filter":{"group":"Spellbound Academy"}},{"type":"tag","who":"neighbors","archetype":"Wizards"}]'::jsonb, false),
('hexie', 'Hexie', 'Spellbound Academy', 'Wizards', array['Female','Villain']::text[], '[{"type":"boost","op":"add","n":-4,"who":"opposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('bookwyrm', 'Spellbook', 'Spellbound Academy', 'Wizards', array['Prop']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Spellbound Academy"}}]'::jsonb, false),
('potion', 'Bubbly Potion', 'Spellbound Academy', 'Wizards', array['Prop']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"purple"}}]'::jsonb, false),
('owl_hoot', 'Hootsworth', 'Spellbound Academy', 'Wizards', array['Male','Animal']::text[], '[{"type":"boost","op":"mul","n":3,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Fizzwick"}}}]'::jsonb, false),
('fizzwick_pro', 'Fizzwick', 'Spellbound Academy', 'Wizards', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Spellbound Academy"}}}]'::jsonb, false),
('cosmo_crys', 'Crystalia', 'Spellbound Academy', 'Wizards', array['Female']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","cond":{"kind":"opposite","filter":{"archetype":"Ghosts"}}}]'::jsonb, false),
('grimble', 'Grimble', 'Spellbound Academy', 'Wizards', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":-2,"who":"all","filter":{"group":"Boo Crew"}}]'::jsonb, false),
('emberine', 'Emberine', 'Spellbound Academy', 'Wizards', array['Female','Hero']::text[], '[{"type":"boost","op":"add","n":3,"who":"self","each":{"where":"neighbors","filter":{"color":"orange"}}}]'::jsonb, false),
('toadwart', 'Toadwart', 'Spellbound Academy', 'Wizards', array['Male']::text[], '[]'::jsonb, false),
('broomzy', 'Broomzy', 'Spellbound Academy', 'Wizards', array['Prop']::text[], '[{"type":"recolor","color":"purple","who":"neighbors"}]'::jsonb, false),
('pupil', 'Ada', 'Spellbound Academy', 'Wizards', array['Female']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"feature":"Hero"}}]'::jsonb, false),
('runestone', 'Ringo', 'Spellbound Academy', 'Wizards', array['Male']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"group":"Spellbound Academy"}}}]'::jsonb, false),
('boltz', 'Boltz', 'Gearworks', 'Robots', array['Prop']::text[], '[]'::jsonb, false),
('sprocket', 'Sprocket', 'Gearworks', 'Robots', array['Female','Prop']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Gearworks"}}}]'::jsonb, false),
('megacrank', 'Mega Crank', 'Gearworks', 'Robots', array['Vehicle']::text[], '[]'::jsonb, false),
('wrenchie', 'Wrenchie', 'Gearworks', 'Robots', array['Male']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"silver"}}]'::jsonb, false),
('toastbot', 'Toastbot', 'Gearworks', 'Robots', array['Prop']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"feature":"Prop"}}}]'::jsonb, false),
('overclock', 'Overclock', 'Gearworks', 'Robots', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":-2,"who":"all","filter":{"group":"Shadow Dojo"}}]'::jsonb, false),
('scrapyard', 'Scrap Heap Yard', 'Gearworks', 'Robots', array['Place']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Gearworks"}}]'::jsonb, false),
('boltz_jr', 'Boltz', 'Gearworks', 'Robots', array['Prop']::text[], '[{"type":"boost","op":"mul","n":4,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Sprocket"}}}]'::jsonb, false),
('dronie', 'Dronie', 'Gearworks', 'Robots', array['Prop']::text[], '[{"type":"recolor","color":"blue","who":"neighbors"}]'::jsonb, false),
('gearbeast', 'Gear Hound', 'Gearworks', 'Robots', array['Animal','Prop']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"feature":"Prop"}}]'::jsonb, false),
('voltara', 'Voltara', 'Gearworks', 'Robots', array['Female','Hero']::text[], '[]'::jsonb, false),
('clanker', 'Clanker', 'Gearworks', 'Robots', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":-4,"who":"opposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('nanobot', 'Nano Swarm', 'Gearworks', 'Robots', array['Prop']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"group":"Gearworks"}}}]'::jsonb, false),
('servo', 'Servo', 'Gearworks', 'Robots', array['Male','Prop']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","each":{"where":"neighbors","filter":{"color":"silver"}}}]'::jsonb, false),
('boobee', 'Boobert', 'Boo Crew', 'Ghosts', array['Male','Monster']::text[], '[]'::jsonb, false),
('wailina', 'Wailina', 'Boo Crew', 'Ghosts', array['Female','Monster']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Boo Crew"}}}]'::jsonb, false),
('poltergust', 'Poltergust', 'Boo Crew', 'Ghosts', array['Male','Villain','Monster']::text[], '[{"type":"boost","op":"add","n":-3,"who":"neighborsOrOpposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('chainsy', 'Chainsy', 'Boo Crew', 'Ghosts', array['Male','Monster']::text[], '[{"type":"boost","op":"add","n":3,"who":"allOther","filter":{"group":"Boo Crew"}}]'::jsonb, false),
('boobee_sheet', 'Boobert', 'Boo Crew', 'Ghosts', array['Male','Monster']::text[], '[{"type":"boost","op":"mul","n":3,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Wailina"}}}]'::jsonb, false),
('creakhouse', 'Creaky Attic', 'Boo Crew', 'Ghosts', array['Place']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Boo Crew"}}]'::jsonb, false),
('glimmerghost', 'Lanterna', 'Boo Crew', 'Ghosts', array['Female','Monster']::text[], '[]'::jsonb, false),
('spookitty', 'Spookitty', 'Boo Crew', 'Ghosts', array['Animal','Monster']::text[], '[{"type":"recolor","color":"purple","who":"neighbors"}]'::jsonb, false),
('fogg', 'Fogg', 'Boo Crew', 'Ghosts', array['Male','Monster']::text[], '[]'::jsonb, false),
('shriek', 'Shriek', 'Boo Crew', 'Ghosts', array['Female','Monster']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"blue"}}]'::jsonb, false),
('ectopup', 'Ecto-Pup', 'Boo Crew', 'Ghosts', array['Animal','Monster']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"feature":"Monster"}}]'::jsonb, false),
('haunttv', 'Haunted Telly', 'Boo Crew', 'Ghosts', array['Prop','Monster']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"where":"inPlay","filter":{"feature":"Monster"}}}]'::jsonb, false),
('phantomime', 'Phantomime', 'Boo Crew', 'Ghosts', array['Male','Villain','Monster']::text[], '[{"type":"boost","op":"add","n":-4,"who":"opposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('whisp_twin', 'Whisper Wheeze', 'Boo Crew', 'Ghosts', array['Monster']::text[], '[]'::jsonb, false),
('redbeard', 'Rumbeard', 'Bubblesea Buccaneers', 'Pirates', array['Male','Villain']::text[], '[]'::jsonb, false),
('polly', 'Squawkers', 'Bubblesea Buccaneers', 'Pirates', array['Animal']::text[], '[]'::jsonb, false),
('deckhand', 'Dottie', 'Bubblesea Buccaneers', 'Pirates', array['Female']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Bubblesea Buccaneers"}}}]'::jsonb, false),
('saltyship', 'Soggy Biscuit', 'Bubblesea Buccaneers', 'Pirates', array['Vehicle']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Bubblesea Buccaneers"}}]'::jsonb, false),
('hookie', 'Hookie', 'Bubblesea Buccaneers', 'Pirates', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":-4,"who":"opposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('goldie', 'Goldie', 'Bubblesea Buccaneers', 'Pirates', array['Female']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"yellow"}}]'::jsonb, false),
('admiral', 'Anchorsworth', 'Bubblesea Buccaneers', 'Pirates', array['Male']::text[], '[{"type":"boost","op":"add","n":3,"who":"allOther","filter":{"group":"Bubblesea Buccaneers"}}]'::jsonb, false),
('peglegpete', 'Bart', 'Bubblesea Buccaneers', 'Pirates', array['Male']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","cond":{"kind":"opposite","filter":{"archetype":"Sea Creatures"}}}]'::jsonb, false),
('cannonball', 'Kip', 'Bubblesea Buccaneers', 'Pirates', array['Male']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"group":"Bubblesea Buccaneers"}}}]'::jsonb, false),
('treasurem', 'Tess', 'Bubblesea Buccaneers', 'Pirates', array['Female','Hero']::text[], '[{"type":"recolor","color":"orange","who":"neighbors"}]'::jsonb, false),
('redbeard_ghost', 'Rumbeard', 'Bubblesea Buccaneers', 'Pirates', array['Male','Villain','Monster']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"feature":"Villain"}}}]'::jsonb, false),
('sharkbait', 'Hattie', 'Bubblesea Buccaneers', 'Pirates', array['Female']::text[], '[{"type":"boost","op":"add","n":-2,"who":"all","filter":{"group":"Coral Reefers"}}]'::jsonb, false),
('monkey_m', 'Mizzen', 'Bubblesea Buccaneers', 'Pirates', array['Animal']::text[], '[{"type":"boost","op":"add","n":2,"who":"neighbors","filter":{"feature":"Male"}}]'::jsonb, false),
('krakenkid', 'Ike', 'Bubblesea Buccaneers', 'Pirates', array['Male','Villain']::text[], '[]'::jsonb, false),
('kitsu', 'Kitsu', 'Shadow Dojo', 'Ninjas', array['Female','Hero','Animal']::text[], '[]'::jsonb, false),
('pandakick', 'Rollo', 'Shadow Dojo', 'Ninjas', array['Male','Animal']::text[], '[]'::jsonb, false),
('sensei', 'Snailsworth', 'Shadow Dojo', 'Ninjas', array['Male']::text[], '[{"type":"boost","op":"add","n":3,"who":"allOther","filter":{"group":"Shadow Dojo"}}]'::jsonb, false),
('shuriko', 'Shuriko', 'Shadow Dojo', 'Ninjas', array['Female','Hero']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Shadow Dojo"}}}]'::jsonb, false),
('smokebomb', 'Sid', 'Shadow Dojo', 'Ninjas', array['Male']::text[], '[{"type":"recolor","color":"purple","who":"neighbors"}]'::jsonb, false),
('dojo', 'Moonlight Dojo', 'Shadow Dojo', 'Ninjas', array['Place']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Shadow Dojo"}}]'::jsonb, false),
('kitsu_shadow', 'Kitsu', 'Shadow Dojo', 'Ninjas', array['Female','Hero','Animal']::text[], '[{"type":"boost","op":"add","n":-5,"who":"opposite","filter":{"feature":"Villain"}}]'::jsonb, false),
('blinkblade', 'Blinkblade', 'Shadow Dojo', 'Ninjas', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":-3,"who":"neighborsOrOpposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('froggy_n', 'Ribbit', 'Shadow Dojo', 'Ninjas', array['Male','Animal']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"group":"Shadow Dojo"}}}]'::jsonb, false),
('cherry', 'Bo', 'Shadow Dojo', 'Ninjas', array['Female']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"red"}}]'::jsonb, false),
('oni_onigiri', 'Oni-Giri', 'Shadow Dojo', 'Ninjas', array['Monster']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"feature":"Animal"}}]'::jsonb, false),
('nightowl', 'Nori', 'Shadow Dojo', 'Ninjas', array['Female']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","cond":{"kind":"opposite","filter":{"archetype":"Robots"}}}]'::jsonb, false),
('lanternfox', 'Lantern Kit', 'Shadow Dojo', 'Ninjas', array['Animal']::text[], '[{"type":"boost","op":"add","n":7,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Kitsu"}}}]'::jsonb, false),
('robo_r', 'Iron Ronin', 'Shadow Dojo', 'Ninjas', array['Male','Villain','Prop']::text[], '[{"type":"boost","op":"add","n":-2,"who":"all","filter":{"group":"Gearworks"}}]'::jsonb, false),
('nutsy', 'Nutsy', 'Critter Burrow', 'Critters', array['Male','Animal']::text[], '[]'::jsonb, false),
('bramble_b', 'Bramble', 'Critter Burrow', 'Critters', array['Male','Animal']::text[], '[]'::jsonb, false),
('hedgie', 'Hedgie', 'Critter Burrow', 'Critters', array['Female','Animal']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Critter Burrow"}}}]'::jsonb, false),
('burrow', 'Big Burrow', 'Critter Burrow', 'Critters', array['Place']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Critter Burrow"}}]'::jsonb, false),
('bunbun', 'Bunsy', 'Critter Burrow', 'Critters', array['Female','Animal']::text[], '[]'::jsonb, false),
('racoon', 'Rascal', 'Critter Burrow', 'Critters', array['Male','Villain','Animal']::text[], '[{"type":"boost","op":"add","n":-3,"who":"neighborsOrOpposite","filter":{"feature":"Animal"}}]'::jsonb, false),
('mole', 'Molly', 'Critter Burrow', 'Critters', array['Female','Animal']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"feature":"Animal"}}]'::jsonb, false),
('otter', 'Ollie', 'Critter Burrow', 'Critters', array['Male','Animal']::text[], '[{"type":"boost","op":"add","n":3,"who":"self","each":{"where":"neighbors","filter":{"color":"blue"}}}]'::jsonb, false),
('skunk', 'Steve', 'Critter Burrow', 'Critters', array['Male','Animal']::text[], '[{"type":"boost","op":"add","n":-4,"who":"opposite","filter":{"feature":"Animal"}}]'::jsonb, false),
('possum', 'Granny Possum', 'Critter Burrow', 'Critters', array['Female','Animal']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"orange"}}]'::jsonb, false),
('frogking', 'Tad', 'Critter Burrow', 'Critters', array['Male','Animal']::text[], '[{"type":"boost","op":"mul","n":3,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Nutsy"}}}]'::jsonb, false),
('mousey', 'Squeaks', 'Critter Burrow', 'Critters', array['Male','Animal']::text[], '[]'::jsonb, false),
('nutsy_jet', 'Nutsy', 'Critter Burrow', 'Critters', array['Male','Animal']::text[], '[{"type":"recolor","color":"orange","who":"neighbors"}]'::jsonb, false),
('beaver', 'Chompsy', 'Critter Burrow', 'Critters', array['Female','Animal']::text[], '[{"type":"boost","op":"add","n":2,"who":"allOther","filter":{"group":"Critter Burrow"}}]'::jsonb, false),
('inkwell', 'Inkwell', 'Coral Reefers', 'Sea Creatures', array['Male','Animal']::text[], '[]'::jsonb, false),
('puffbert', 'Puffbert', 'Coral Reefers', 'Sea Creatures', array['Male','Animal']::text[], '[{"type":"recolor","color":"yellow","who":"neighbors"}]'::jsonb, false),
('shellby', 'Shellby', 'Coral Reefers', 'Sea Creatures', array['Female','Animal']::text[], '[]'::jsonb, false),
('crabby', 'Pinchworth', 'Coral Reefers', 'Sea Creatures', array['Male','Villain','Animal']::text[], '[{"type":"boost","op":"add","n":-3,"who":"neighborsOrOpposite","filter":{"feature":"Animal"}}]'::jsonb, false),
('jellie', 'Jellie', 'Coral Reefers', 'Sea Creatures', array['Female','Animal']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Coral Reefers"}}}]'::jsonb, false),
('seahorse', 'Seahoof', 'Coral Reefers', 'Sea Creatures', array['Male','Hero','Animal']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"feature":"Animal"}}]'::jsonb, false),
('coralcastle', 'Coral Castle', 'Coral Reefers', 'Sea Creatures', array['Place']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Coral Reefers"}}]'::jsonb, false),
('whalel', 'Bubba', 'Coral Reefers', 'Sea Creatures', array['Male','Animal']::text[], '[]'::jsonb, false),
('angler', 'Glim', 'Coral Reefers', 'Sea Creatures', array['Female','Villain','Animal']::text[], '[{"type":"boost","op":"add","n":-4,"who":"opposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('starla', 'Starla', 'Coral Reefers', 'Sea Creatures', array['Female','Animal']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"blue"}}]'::jsonb, false),
('mermaidkid', 'Coralie', 'Coral Reefers', 'Sea Creatures', array['Female','Hero']::text[], '[]'::jsonb, false),
('inkwell_baby', 'Inkwell', 'Coral Reefers', 'Sea Creatures', array['Male','Animal']::text[], '[{"type":"boost","op":"mul","n":4,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Seahoof"}}}]'::jsonb, false),
('clamshell', 'Clammy', 'Coral Reefers', 'Sea Creatures', array['Animal']::text[], '[{"type":"boost","op":"add","n":3,"who":"allOther","filter":{"group":"Coral Reefers"}}]'::jsonb, false),
('eel_zap', 'Sparky', 'Coral Reefers', 'Sea Creatures', array['Male','Animal']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"where":"inPlay","filter":{"feature":"Animal"}}}]'::jsonb, false),
('zorp', 'Zorp', 'Saucer Squad', 'Space Aliens', array['Male']::text[], '[]'::jsonb, false),
('glorbina', 'Glorbina', 'Saucer Squad', 'Space Aliens', array['Female']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Saucer Squad"}}},{"type":"tag","who":"self","all":true}]'::jsonb, true),
('saucer', 'Wobble Saucer', 'Saucer Squad', 'Space Aliens', array['Vehicle']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Saucer Squad"}}]'::jsonb, false),
('blorgo', 'Blorgo', 'Saucer Squad', 'Space Aliens', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":-2,"who":"all","filter":{"group":"Galaxy Gang"}}]'::jsonb, false),
('moonmoo', 'Moon Moo', 'Saucer Squad', 'Space Aliens', array['Animal']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"feature":"Animal"}}]'::jsonb, false),
('zorp_ray', 'Zorp', 'Saucer Squad', 'Space Aliens', array['Male']::text[], '[{"type":"boost","op":"mul","n":3,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Glorbina"}}}]'::jsonb, false),
('nebulina', 'Nebulina', 'Saucer Squad', 'Space Aliens', array['Female']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","cond":{"kind":"opposite","filter":{"archetype":"Galaxy"}}}]'::jsonb, false),
('gloopgoo', 'Goo-Goo', 'Saucer Squad', 'Space Aliens', array['Monster']::text[], '[{"type":"boost","op":"add","n":-4,"who":"opposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('beamer', 'Beamer', 'Saucer Squad', 'Space Aliens', array['Prop']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"green"}}]'::jsonb, false),
('spudnik', 'Spudnik', 'Saucer Squad', 'Space Aliens', array['Male']::text[], '[{"type":"recolor","color":"green","who":"neighbors"}]'::jsonb, false),
('crater', 'Crater Kid', 'Saucer Squad', 'Space Aliens', array['Male','Hero']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"group":"Saucer Squad"}}}]'::jsonb, false),
('elder', 'Glimmerbrain', 'Saucer Squad', 'Space Aliens', array['Male']::text[], '[{"type":"boost","op":"add","n":3,"who":"allOther","filter":{"group":"Saucer Squad"}}]'::jsonb, false),
('starpup', 'Comet Critter', 'Saucer Squad', 'Space Aliens', array['Animal']::text[], '[]'::jsonb, false),
('zapzorb', 'Zapzorb', 'Saucer Squad', 'Space Aliens', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":-3,"who":"neighborsOrOpposite","filter":{"feature":"Male"}}]'::jsonb, false),
('blazey', 'Blazey', 'Elemental Storm', 'Elementals', array['Male']::text[], '[]'::jsonb, false),
('splashy', 'Splashy', 'Elemental Storm', 'Elementals', array['Female']::text[], '[]'::jsonb, false),
('pebble', 'Pebbles', 'Elemental Storm', 'Elementals', array['Male']::text[], '[]'::jsonb, false),
('gusty', 'Gusty', 'Elemental Storm', 'Elementals', array['Female']::text[], '[{"type":"boost","op":"add","n":2,"who":"allOther","filter":{"group":"Elemental Storm"}}]'::jsonb, false),
('voltie', 'Voltie', 'Elemental Storm', 'Elementals', array['Male']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Elemental Storm"}}}]'::jsonb, false),
('mudslide', 'Muddle', 'Elemental Storm', 'Elementals', array['Male']::text[], '[{"type":"recolor","color":"green","who":"neighbors"}]'::jsonb, false),
('frosty', 'Frostina', 'Elemental Storm', 'Elementals', array['Female','Villain']::text[], '[{"type":"boost","op":"add","n":-4,"who":"opposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('magmatt', 'Magma Matt', 'Elemental Storm', 'Elementals', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":-2,"who":"all","filter":{"group":"Coral Reefers"}}]'::jsonb, false),
('blazey_inferno', 'Blazey', 'Elemental Storm', 'Elementals', array['Male']::text[], '[{"type":"boost","op":"add","n":3,"who":"self","each":{"where":"neighbors","filter":{"color":"red"}}}]'::jsonb, false),
('sproutling', 'Sproutling', 'Elemental Storm', 'Elementals', array['Female']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"green"}}]'::jsonb, false),
('crystalcave', 'Crystal Core', 'Elemental Storm', 'Elementals', array['Place']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Elemental Storm"}}]'::jsonb, false),
('stormy', 'Stormy', 'Elemental Storm', 'Elementals', array['Male']::text[], '[]'::jsonb, false),
('sandy', 'Sandy', 'Elemental Storm', 'Elementals', array['Female']::text[], '[{"type":"boost","op":"add","n":8,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Gusty"}}}]'::jsonb, false),
('smog', 'Smoggle', 'Elemental Storm', 'Elementals', array['Villain']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"feature":"Villain"}}}]'::jsonb, false),
('mumbles', 'Mumbles', 'Tomb Rattlers', 'Undead', array['Male','Monster']::text[], '[]'::jsonb, false),
('pharoh', 'Wrapsody', 'Tomb Rattlers', 'Undead', array['Male','Monster']::text[], '[{"type":"boost","op":"add","n":3,"who":"allOther","filter":{"group":"Tomb Rattlers"}}]'::jsonb, false),
('rattles', 'Rattles', 'Tomb Rattlers', 'Undead', array['Male','Monster']::text[], '[]'::jsonb, false),
('zomb', 'Zeke', 'Tomb Rattlers', 'Undead', array['Male','Monster']::text[], '[{"type":"boost","op":"add","n":-3,"who":"neighborsOrOpposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('mumbles_wrap', 'Mumbles', 'Tomb Rattlers', 'Undead', array['Male','Monster']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Tomb Rattlers"}}}]'::jsonb, false),
('tomb', 'Rattling Tomb', 'Tomb Rattlers', 'Undead', array['Place']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Tomb Rattlers"}}]'::jsonb, false),
('gravedigger', 'Digby', 'Tomb Rattlers', 'Undead', array['Male']::text[], '[{"type":"boost","op":"add","n":-5,"who":"opposite","filter":{"feature":"Monster"}}]'::jsonb, false),
('banshee', 'Rattlebone', 'Tomb Rattlers', 'Undead', array['Female','Villain','Monster']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","cond":{"kind":"opposite","filter":{"archetype":"Fairies"}}}]'::jsonb, false),
('bonedog', 'Fetch', 'Tomb Rattlers', 'Undead', array['Animal','Monster']::text[], '[{"type":"boost","op":"mul","n":3,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Rattles"}}}]'::jsonb, false),
('cat_mummy', 'Whiskerwrap', 'Tomb Rattlers', 'Undead', array['Animal','Monster']::text[], '[{"type":"recolor","color":"yellow","who":"neighbors"}]'::jsonb, false),
('zombiechef', 'Rotten-Toot', 'Tomb Rattlers', 'Undead', array['Male','Monster']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"yellow"}}]'::jsonb, false),
('lichling', 'Lichling', 'Tomb Rattlers', 'Undead', array['Male','Villain','Monster']::text[], '[{"type":"boost","op":"add","n":-2,"who":"all","filter":{"group":"Pixie Glen"}}]'::jsonb, false),
('vampbat', 'Nibbles', 'Tomb Rattlers', 'Undead', array['Animal','Monster']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"where":"inPlay","filter":{"feature":"Monster"}}}]'::jsonb, false),
('ghoulgirl', 'Gravella', 'Tomb Rattlers', 'Undead', array['Female','Monster']::text[], '[]'::jsonb, false),
('gummo', 'Gummo', 'Sweet Tooth Town', 'Candy Folk', array['Male']::text[], '[]'::jsonb, false),
('lolli', 'Lolli', 'Sweet Tooth Town', 'Candy Folk', array['Female']::text[], '[]'::jsonb, false),
('cupcake', 'Cupcake', 'Sweet Tooth Town', 'Candy Folk', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Sweet Tooth Town"}}}]'::jsonb, false),
('gumdrop', 'Gail', 'Sweet Tooth Town', 'Candy Folk', array['Female']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"group":"Sweet Tooth Town"}}}]'::jsonb, false),
('choco', 'Fudge', 'Sweet Tooth Town', 'Candy Folk', array['Male']::text[], '[{"type":"boost","op":"add","n":3,"who":"allOther","filter":{"group":"Sweet Tooth Town"}}]'::jsonb, false),
('candyshop', 'Sugarplum Shoppe', 'Sweet Tooth Town', 'Candy Folk', array['Place']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Sweet Tooth Town"}}]'::jsonb, false),
('sourpuss', 'Sally', 'Sweet Tooth Town', 'Candy Folk', array['Female','Villain']::text[], '[{"type":"boost","op":"add","n":-4,"who":"opposite","filter":{"feature":"Hero"}}]'::jsonb, false),
('caramel', 'Caramelo', 'Sweet Tooth Town', 'Candy Folk', array['Male']::text[], '[{"type":"recolor","color":"orange","who":"neighbors"}]'::jsonb, false),
('bubblegum', 'Bubbles', 'Sweet Tooth Town', 'Candy Folk', array['Female']::text[], '[{"type":"boost","op":"add","n":3,"who":"self","each":{"where":"neighbors","filter":{"color":"purple"}}}]'::jsonb, false),
('mint', 'Minty', 'Sweet Tooth Town', 'Candy Folk', array['Male']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"orange"}}]'::jsonb, false),
('cupcake_mega', 'Cupcake', 'Sweet Tooth Town', 'Candy Folk', array['Male','Hero']::text[], '[]'::jsonb, false),
('jawbreaker', 'Jax', 'Sweet Tooth Town', 'Candy Folk', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":-3,"who":"neighborsOrOpposite","filter":{"feature":"Female"}}]'::jsonb, false),
('cottonc', 'Cotton Candy', 'Sweet Tooth Town', 'Candy Folk', array['Female']::text[], '[{"type":"boost","op":"add","n":6,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Cupcake"}}}]'::jsonb, false),
('licorice', 'Larry', 'Sweet Tooth Town', 'Candy Folk', array['Male']::text[], '[{"type":"boost","op":"add","n":2,"who":"neighbors","filter":{"feature":"Male"}}]'::jsonb, false),
('rexie', 'Rexie', 'Dino Stompers', 'Dinos', array['Male','Animal']::text[], '[]'::jsonb, false),
('tricera', 'Trixie', 'Dino Stompers', 'Dinos', array['Female','Animal']::text[], '[{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"inPlay","filter":{"group":"Dino Stompers"}}}]'::jsonb, false),
('ptero', 'Ptero Pete', 'Dino Stompers', 'Dinos', array['Male','Animal']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"group":"Dino Stompers"}}}]'::jsonb, false),
('stego', 'Steggy', 'Dino Stompers', 'Dinos', array['Male','Animal']::text[], '[]'::jsonb, false),
('bronto', 'Bertie', 'Dino Stompers', 'Dinos', array['Female','Animal']::text[], '[]'::jsonb, false),
('raptor', 'Razz', 'Dino Stompers', 'Dinos', array['Male','Villain','Animal']::text[], '[{"type":"boost","op":"add","n":-3,"who":"neighborsOrOpposite","filter":{"feature":"Animal"}}]'::jsonb, false),
('dinoegg', 'Eggbert', 'Dino Stompers', 'Dinos', array['Animal']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"color":"green"}}]'::jsonb, false),
('rexie_baby', 'Rexie', 'Dino Stompers', 'Dinos', array['Male','Animal']::text[], '[{"type":"boost","op":"mul","n":3,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Trixie"}}}]'::jsonb, false),
('ankylo', 'Carl', 'Dino Stompers', 'Dinos', array['Male','Animal']::text[], '[{"type":"boost","op":"add","n":-5,"who":"opposite","filter":{"feature":"Villain"}}]'::jsonb, false),
('jungle', 'Prehistoric Peak', 'Dino Stompers', 'Dinos', array['Place']::text[], '[{"type":"boost","op":"add","n":2,"who":"all","filter":{"group":"Dino Stompers"}}]'::jsonb, false),
('caveman', 'Grug', 'Dino Stompers', 'Dinos', array['Male']::text[], '[{"type":"boost","op":"add","n":3,"who":"allOther","filter":{"group":"Dino Stompers"}}]'::jsonb, false),
('spino', 'Spinny', 'Dino Stompers', 'Dinos', array['Male','Animal']::text[], '[{"type":"recolor","color":"purple","who":"neighbors"}]'::jsonb, false),
('dilo', 'Frillophus', 'Dino Stompers', 'Dinos', array['Female','Animal']::text[], '[{"type":"boost","op":"add","n":3,"who":"self","each":{"where":"neighbors","filter":{"color":"green"}}}]'::jsonb, false),
('pachy', 'Bonk', 'Dino Stompers', 'Dinos', array['Male','Animal']::text[], '[]'::jsonb, false),
('ob_nightbane', 'Nightbane', 'Obsidian Order', 'Obsidian Order', array['Male','Villain']::text[], '[{"type":"tag","who":"self","archetype":"Knights"},{"type":"boost","op":"add","n":3,"who":"allOther","filter":{"group":"Obsidian Order"}}]'::jsonb, false),
('ob_onyxion', 'Onyxion', 'Obsidian Order', 'Obsidian Order', array['Male','Monster']::text[], '[{"type":"tag","who":"self","archetype":"Dragons"},{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Nightbane"}}}]'::jsonb, false),
('ob_drakerider', 'Vex', 'Obsidian Order', 'Obsidian Order', array['Male','Villain']::text[], '[{"type":"tag","who":"self","archetype":"Knights"},{"type":"tag","who":"self","archetype":"Dragons"},{"type":"boost","op":"add","n":3,"who":"self","each":{"where":"ownSide","filter":{"archetype":"Dragons"}}}]'::jsonb, false),
('ob_shadewyrm', 'Umbrafang', 'Obsidian Order', 'Obsidian Order', array['Monster','Villain']::text[], '[{"type":"tag","who":"self","archetype":"Dragons"},{"type":"boost","op":"add","n":-5,"who":"opposite"},{"type":"boost","op":"add","n":2,"who":"self","each":{"where":"neighbors","filter":{"group":"Obsidian Order"}}}]'::jsonb, false),
('ob_embersquire', 'Ashby', 'Obsidian Order', 'Obsidian Order', array['Male','Hero']::text[], '[{"type":"tag","who":"self","archetype":"Knights"},{"type":"recolor","color":"red","who":"neighbors"},{"type":"boost","op":"mul","n":4,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Nightbane"}}}]'::jsonb, false),
('ob_smolder', 'Smolder', 'Obsidian Order', 'Obsidian Order', array['Monster','Animal']::text[], '[{"type":"tag","who":"self","archetype":"Dragons"},{"type":"boost","op":"mul","n":3,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Onyxion"}}},{"type":"boost","op":"add","n":2,"who":"neighbors","filter":{"archetype":"Dragons"}}]'::jsonb, false),
('ob_citadel', 'Obsidian Citadel', 'Obsidian Order', 'Obsidian Order', array['Place']::text[], '[{"type":"boost","op":"add","n":3,"who":"all","filter":{"group":"Obsidian Order"}},{"type":"tag","who":"neighbors","archetype":"Dragons"}]'::jsonb, false),
('ob_ravenna', 'Ravenna', 'Obsidian Order', 'Obsidian Order', array['Female','Villain']::text[], '[{"type":"tag","who":"self","archetype":"Knights"},{"type":"boost","op":"add","n":3,"who":"self","each":{"where":"inPlay","filter":{"group":"Obsidian Order"}}}]'::jsonb, false)
on conflict (id) do update set char_name = excluded.char_name, grp = excluded.grp, archetype = excluded.archetype, features = excluded.features, powers = excluded.powers, wild = excluded.wild;

insert into public.combo_pairs (id, name, a, b, bonus) values
('oath', 'Oath of Flame', 'Dragons', 'Knights', 3),
('stormschool', 'Storm School', 'Wizards', 'Elementals', 3),
('tide', 'Tide Pact', 'Pirates', 'Sea Creatures', 3),
('orbit', 'Orbit Factory', 'Robots', 'Space Aliens', 3),
('doublehaunt', 'Double Haunt', 'Ghosts', 'Undead', 3),
('nightburrow', 'Night Burrow', 'Ninjas', 'Critters', 3),
('sugarwing', 'Sugarwing', 'Candy Folk', 'Fairies', 3),
('fossil', 'Fossil Storm', 'Dinos', 'Elementals', 3),
('startreaty', 'Star Treaty', 'Galaxy', 'Space Aliens', 3),
('spookypact', 'Spooky Pact', 'Spooks', 'Ghosts', 3),
('fuzzy', 'Fuzzy Farm', 'Barnyard', 'Critters', 3),
('garden', 'Garden Pact', 'Sprouts', 'Fairies', 3),
('premiere', 'Sweet Premiere', 'Toons', 'Candy Folk', 3)
on conflict (id) do update set name = excluded.name, a = excluded.a, b = excluded.b, bonus = excluded.bonus;

insert into public.combo_sets (id, name, bonus, ids) values
('pirate', 'Pirate Crew', 6, array['redbeard','polly']::text[]),
('bridge', 'Bridge Crew', 8, array['zoomer','nell','starhopper']::text[]),
('mud', 'Mud Buddies', 6, array['hank','fritz']::text[]),
('sproutpals', 'Sprout Pals', 8, array['pip','daisy','petal']::text[]),
('parade', 'Town Parade', 8, array['mayor','mel','blaze']::text[]),
('roast', 'Dragon Roast', 6, array['ember','glimmer']::text[]),
('glade', 'Moonlit Glade', 8, array['twinkle','dewdrop','glowbug']::text[]),
('guard', 'Royal Guard', 6, array['sirbumble','dame_dash']::text[]),
('spell', 'Spell Team', 6, array['fizzwick','madame_m']::text[]),
('gear', 'Gear Pair', 6, array['boltz','sprocket']::text[]),
('boobuddies', 'Boo Buddies', 6, array['boobee','wailina']::text[]),
('shadow', 'Shadow Step', 6, array['kitsu','shuriko']::text[]),
('burrow', 'Burrow Buds', 6, array['nutsy','bunbun']::text[]),
('reef', 'Reef Pals', 6, array['inkwell','starla']::text[]),
('saucer', 'Saucer Pair', 6, array['zorp','glorbina']::text[]),
('storm', 'Storm Twins', 6, array['blazey','splashy']::text[]),
('tomb', 'Tomb Duo', 6, array['mumbles','pharoh']::text[]),
('sweet', 'Sweet Shop', 8, array['gummo','lolli','mint']::text[]),
('stomp', 'Dino Stomp', 6, array['rexie','tricera']::text[]),
('spacewalk', 'Space Walk', 6, array['zoomer','zorp']::text[]),
('booclub', 'Boo Club', 6, array['bonesy','boobee']::text[]),
('farm', 'Farm Friends', 6, array['hank','nutsy']::text[]),
('gardenshow', 'Garden Show', 6, array['petal','twinkle']::text[]),
('candyprem', 'Candy Premiere', 6, array['blaze','lolli']::text[]),
('robotpal', 'Robot Pal', 6, array['bleep','boltz']::text[]),
('fang', 'Fang Club', 6, array['fangly','bertha']::text[]),
('ob_mount', 'Black Knight & Obsidian Dragon', 10, array['ob_nightbane','ob_onyxion']::text[]),
('ob_ashfall', 'Ashfall Riders', 14, array['ob_drakerider','ob_shadewyrm','ob_embersquire']::text[])
on conflict (id) do update set name = excluded.name, bonus = excluded.bonus, ids = excluded.ids;

revoke all on public.card_rules, public.combo_pairs, public.combo_sets from public, anon, authenticated;

create or replace function public.engine_adj(p_slot int)
returns int[] language sql immutable as $$
  select case p_slot
    when 0 then array[1,4]::int[]
    when 1 then array[0,2,4,5]
    when 2 then array[1,3,5,6]
    when 3 then array[2,6]
    when 4 then array[0,1,5]
    when 5 then array[1,2,4,6]
    when 6 then array[2,3,5]
    else '{}'::int[]
  end;
$$;

create or replace function public.engine_match(
  p_features text[], p_char text, p_group text, p_color text,
  p_arches text[], p_wild boolean, p_filter jsonb
) returns boolean language plpgsql immutable as $$
begin
  if p_filter is null or jsonb_typeof(p_filter) = 'null' then return true; end if;
  if p_filter ? 'color' and p_color is distinct from p_filter->>'color' then return false; end if;
  if p_filter ? 'feature' and not (p_filter->>'feature' = any(coalesce(p_features, '{}'))) then return false; end if;
  if p_filter ? 'notFeature' and (p_filter->>'notFeature' = any(coalesce(p_features, '{}'))) then return false; end if;
  if p_filter ? 'char' and p_char is distinct from p_filter->>'char' then return false; end if;
  if p_filter ? 'group' and p_group is distinct from p_filter->>'group' then return false; end if;
  if p_filter ? 'archetype' and not coalesce(p_wild, false) and not (p_filter->>'archetype' = any(coalesce(p_arches, '{}'))) then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.seat_phase_full(p_state jsonb, p_seat text, p_phase text)
returns boolean language sql immutable as $$
  select not exists (
    select 1
    from generate_series(case when p_phase = 'place1' then 0 else 4 end, case when p_phase = 'place1' then 3 else 6 end) slot
    where (p_state->p_seat->'board')->slot is null
       or (p_state->p_seat->'board')->slot = 'null'::jsonb
  );
$$;

create or replace function public.engine_score(p_state jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  r record;
  src record;
  pw jsonb;
  times int;
  kinds int;
  host_pts int := 0;
  guest_pts int := 0;
  host_pen int;
  guest_pen int;
  goals text[] := '{}';
  gcol text;
  bonus_side text := null;
  lead text := null;
  winner text;
  p_count int;
  o_count int;
  g1 text;
  g2 text;
begin
  create temp table if not exists es (
    side text, slot int, cid text, char_name text, grp text, archetype text,
    features text[], powers jsonb, wild boolean, knocked boolean, color text,
    mul numeric, add int, arches text[], pts int, primary key (side, slot)
  ) on commit drop;
  delete from es;
  insert into es (side, slot, cid, char_name, grp, archetype, features, powers, wild, knocked, color, mul, add, arches, pts)
  select seat.side, slot.i,
    case when jsonb_typeof(p_state->seat.side->'board'->slot.i) = 'object' then p_state->seat.side->'board'->slot.i->>'id' else null end,
    coalesce(rules.char_name, ''), coalesce(rules.grp, ''), coalesce(rules.archetype, ''),
    coalesce(rules.features, '{}'), coalesce(rules.powers, '[]'::jsonb), coalesce(rules.wild, false),
    false, coalesce(rules_color.color, ''), 1, 0,
    case when coalesce(rules.archetype, '') <> '' then array[rules.archetype] else '{}'::text[] end,
    coalesce(rules_color.pts, 0)
  from (values ('host'), ('guest')) seat(side)
  cross join generate_series(0, 6) slot(i)
  left join public.card_rules rules on rules.id = case when jsonb_typeof(p_state->seat.side->'board'->slot.i) = 'object' then p_state->seat.side->'board'->slot.i->>'id' else null end
  left join public.cards rules_color on rules_color.id = rules.id
  where case when jsonb_typeof(p_state->seat.side->'board'->slot.i) = 'object' then p_state->seat.side->'board'->slot.i->>'id' else null end is not null;

  update es a set knocked = true
  where (select count(*) from es b where b.cid = a.cid) > 1;

  update es a set knocked = true
  where not a.knocked and exists (
    select 1 from es b
    where b.char_name = a.char_name and b.char_name <> '' and b.pts < a.pts and not b.knocked
      and (select count(*) from es c where c.char_name = a.char_name) > 1
  );
  update es a set knocked = true
  where not a.knocked and a.char_name <> '' and (
    select count(*) from es b where b.char_name = a.char_name and b.pts = a.pts
      and not exists (select 1 from es c where c.char_name = a.char_name and c.pts < a.pts)
  ) > 1;

  -- recolor
  for src in select * from es where not knocked loop
    for pw in select value from jsonb_array_elements(src.powers) loop
      if pw->>'type' <> 'recolor' then continue; end if;
      update es t set color = pw->>'color'
      where t.side = src.side and t.slot = any(public.engine_adj(src.slot)) and not t.knocked and t.color is distinct from pw->>'color';
    end loop;
  end loop;
  -- tags
  for src in select * from es where not knocked loop
    for pw in select value from jsonb_array_elements(src.powers) loop
      if pw->>'type' <> 'tag' then continue; end if;
      if coalesce(pw->>'who', 'self') = 'neighbors' then
        update es t set
          wild = t.wild or coalesce((pw->>'all')::boolean, false),
          arches = case when pw ? 'archetype' then t.arches || (pw->>'archetype') else t.arches end
        where t.side = src.side and t.slot = any(public.engine_adj(src.slot)) and not t.knocked;
      else
        update es t set
          wild = t.wild or coalesce((pw->>'all')::boolean, false),
          arches = case when pw ? 'archetype' then t.arches || (pw->>'archetype') else t.arches end
        where t.side = src.side and t.slot = src.slot;
      end if;
    end loop;
  end loop;
  -- boosts
  for src in select * from es where not knocked loop
    for pw in select value from jsonb_array_elements(src.powers) loop
      if pw->>'type' <> 'boost' then continue; end if;
      if pw ? 'cond' then
        if pw->'cond'->>'kind' = 'pure' then
          if (select count(*) from es e where e.side = src.side and not e.knocked) < 2 then continue; end if;
          select count(distinct a) into kinds from es e, unnest(e.arches) a where e.side = src.side and not e.knocked;
          if kinds > 1 then continue; end if;
        elsif pw->'cond'->>'kind' = 'opposite' then
          if not exists (
            select 1 from es e2
            where e2.side = case when src.side = 'host' then 'guest' else 'host' end
              and e2.slot = src.slot and not e2.knocked
              and public.engine_match(e2.features, e2.char_name, e2.grp, e2.color, e2.arches, e2.wild, pw->'cond'->'filter')
          ) then continue; end if;
        else
          if not exists (
            select 1 from es e
            where not e.knocked and (e.side, e.slot) <> (src.side, src.slot)
              and (pw->'cond'->>'kind' <> 'nextTo' or (e.side = src.side and e.slot = any(public.engine_adj(src.slot))))
              and public.engine_match(e.features, e.char_name, e.grp, e.color, e.arches, e.wild, pw->'cond'->'filter')
          ) then continue; end if;
        end if;
      end if;
      times := 1;
      if pw ? 'each' then
        if pw->'each'->>'distinct' = 'archetype' then
          if pw->'each'->>'where' = 'oppSide' then
            select count(distinct a) into kinds from es e, unnest(e.arches) a
            where e.side = case when src.side = 'host' then 'guest' else 'host' end and not e.knocked;
          else
            select count(distinct a) into kinds from es e, unnest(e.arches) a
            where e.side = src.side and not e.knocked;
          end if;
          times := least(4, coalesce(kinds, 0));
        else
          select count(*) into times from es e
          where not e.knocked
            and case pw->'each'->>'where'
              when 'neighbors' then e.side = src.side and e.slot = any(public.engine_adj(src.slot))
              when 'ownSide' then e.side = src.side and (e.side, e.slot) <> (src.side, src.slot)
              when 'oppSide' then e.side = case when src.side = 'host' then 'guest' else 'host' end
              else (e.side, e.slot) <> (src.side, src.slot)
            end
            and public.engine_match(e.features, e.char_name, e.grp, e.color, e.arches, e.wild, pw->'each'->'filter');
        end if;
      end if;
      if times <= 0 then continue; end if;
      update es t set
        mul = case when pw->>'op' = 'mul' then t.mul * power(coalesce((pw->>'n')::numeric, 1), times) else t.mul end,
        add = case when pw->>'op' = 'mul' then t.add else t.add + coalesce((pw->>'n')::int, 0) * times end
      where not t.knocked
        and case coalesce(pw->>'who', 'self')
          when 'self' then t.side = src.side and t.slot = src.slot
          when 'all' then true
          when 'allOther' then (t.side, t.slot) <> (src.side, src.slot)
          when 'neighbors' then t.side = src.side and t.slot = any(public.engine_adj(src.slot))
          when 'opposite' then t.side = case when src.side = 'host' then 'guest' else 'host' end and t.slot = src.slot
          when 'neighborsOrOpposite' then
            (t.side = src.side and t.slot = any(public.engine_adj(src.slot)))
            or (t.side = case when src.side = 'host' then 'guest' else 'host' end and t.slot = src.slot)
          else false
        end
        and (
          coalesce(pw->>'who', 'self') = 'self'
          or public.engine_match(t.features, t.char_name, t.grp, t.color, t.arches, t.wild, pw->'filter')
        );
    end loop;
  end loop;

  -- combos, granted to the lowest printed card on that side
  for src in
    select side from (values ('host'), ('guest')) s(side)
  loop
    declare
      pair record;
      crew record;
      natural_a boolean;
      natural_b boolean;
      has_wild boolean;
    begin
      for pair in select * from public.combo_pairs loop
        select exists(select 1 from es e where e.side = src.side and not e.knocked and not e.wild and pair.a = any(e.arches)) into natural_a;
        select exists(select 1 from es e where e.side = src.side and not e.knocked and not e.wild and pair.b = any(e.arches)) into natural_b;
        select exists(select 1 from es e where e.side = src.side and not e.knocked and e.wild) into has_wild;
        if not ((natural_a and natural_b) or (has_wild and (natural_a <> natural_b))) then continue; end if;
        update es t set add = t.add + pair.bonus
        where t.ctid = (
          select e.ctid from es e
          where e.side = src.side and not e.knocked and (e.wild or pair.a = any(e.arches) or pair.b = any(e.arches))
          order by e.pts, e.slot limit 1
        );
      end loop;
      for crew in select * from public.combo_sets loop
        if (select count(distinct i) from unnest(crew.ids) i where i in (select e.cid from es e where e.side = src.side and not e.knocked)) < array_length(crew.ids, 1) then
          continue;
        end if;
        update es t set add = t.add + crew.bonus
        where t.ctid = (
          select e.ctid from es e
          where e.side = src.side and not e.knocked and e.cid = any(crew.ids)
          order by e.pts, e.slot limit 1
        );
      end loop;
    end;
  end loop;

  select coalesce(sum(greatest(0, round(pts * mul + add))), 0) into host_pts from es where side = 'host' and not knocked;
  select coalesce(sum(greatest(0, round(pts * mul + add))), 0) into guest_pts from es where side = 'guest' and not knocked;
  host_pen := coalesce((p_state->'host'->>'penalty')::int, 0);
  guest_pen := coalesce((p_state->'guest'->>'penalty')::int, 0);
  host_pts := host_pts - host_pen;
  guest_pts := guest_pts - guest_pen;

  -- goal colors from the goal cards, skipping black and silver
  for r in select side from (values ('host'), ('guest')) s(side) loop
    select c.color into gcol from public.cards c
    where c.id = p_state->r.side->'goal'->>'id';
    if gcol is not null and gcol not in ('black', 'silver') and not (gcol = any(goals)) then
      goals := goals || gcol;
    end if;
  end loop;

  if coalesce(array_length(goals, 1), 0) = 1 then
    select count(*) into p_count from es e where e.side = 'host' and not e.knocked and (
      case when e.color = 'silver' and coalesce(p_state->'host'->>'silver', '') <> '' then p_state->'host'->>'silver' else e.color end
    ) = goals[1];
    select count(*) into o_count from es e where e.side = 'guest' and not e.knocked and (
      case when e.color = 'silver' and coalesce(p_state->'guest'->>'silver', '') <> '' then p_state->'guest'->>'silver' else e.color end
    ) = goals[1];
    if p_count > o_count then host_pts := host_pts + 15; bonus_side := 'host';
    elsif o_count > p_count then guest_pts := guest_pts + 15; bonus_side := 'guest'; end if;
  elsif coalesce(array_length(goals, 1), 0) = 2 then
    g1 := goals[1]; g2 := goals[2];
    if (select count(*) from es e where e.side = 'host' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'host'->>'silver','') <> '' then p_state->'host'->>'silver' else e.color end) = g1)
       > (select count(*) from es e where e.side = 'guest' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'guest'->>'silver','') <> '' then p_state->'guest'->>'silver' else e.color end) = g1)
      and (select count(*) from es e where e.side = 'host' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'host'->>'silver','') <> '' then p_state->'host'->>'silver' else e.color end) = g2)
       > (select count(*) from es e where e.side = 'guest' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'guest'->>'silver','') <> '' then p_state->'guest'->>'silver' else e.color end) = g2)
    then lead := 'host';
    elsif (select count(*) from es e where e.side = 'guest' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'guest'->>'silver','') <> '' then p_state->'guest'->>'silver' else e.color end) = g1)
       > (select count(*) from es e where e.side = 'host' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'host'->>'silver','') <> '' then p_state->'host'->>'silver' else e.color end) = g1)
      and (select count(*) from es e where e.side = 'guest' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'guest'->>'silver','') <> '' then p_state->'guest'->>'silver' else e.color end) = g2)
       > (select count(*) from es e where e.side = 'host' and not e.knocked and (case when e.color = 'silver' and coalesce(p_state->'host'->>'silver','') <> '' then p_state->'host'->>'silver' else e.color end) = g2)
    then lead := 'guest';
    end if;
    if lead is not null then
      winner := lead;
    end if;
  end if;
  if winner is null then
    if host_pts > guest_pts then winner := 'host';
    elsif guest_pts > host_pts then winner := 'guest';
    else winner := 'tie'; end if;
  end if;
  return jsonb_build_object('host', host_pts, 'guest', guest_pts, 'winner', winner, 'bonus', bonus_side, 'lead', lead);
end;
$$;

revoke all on function public.engine_adj(int) from public, anon, authenticated;
revoke all on function public.engine_match(text[], text, text, text, text[], boolean, jsonb) from public, anon, authenticated;
revoke all on function public.seat_phase_full(jsonb, text, text) from public, anon, authenticated;
revoke all on function public.engine_score(jsonb) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_move(p_match uuid, p_move jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := public.require_login();
  m public.matches;
  seat text;
  opp text;
  phase text;
  turn text;
  st jsonb;
  side jsonb;
  hand jsonb;
  board jsonb;
  slot int;
  hand_i int;
  card jsonb;
  i int;
  newhand jsonb;
  elem jsonb;
  ord int;
  draw jsonb;
  idxs int[];
  filled boolean;
begin
  select * into m from public.matches where id = p_match for update;
  if m.id is null or m.status <> 'active' then raise exception 'That match is not in progress.'; end if;
  if m.host = uid then seat := 'host'; opp := 'guest';
  elsif m.guest = uid then seat := 'guest'; opp := 'host';
  else raise exception 'You are not in this match.'; end if;
  st := m.state;
  phase := st->>'phase';
  turn := st->>'turn';
  if turn is distinct from seat then raise exception 'Not your turn.'; end if;
  if m.turn_deadline is not null and now() > m.turn_deadline + interval '5 seconds' then
    raise exception 'Turn expired.';
  end if;
  if (p_move->>'t') = 'place' then
    slot := (p_move->>'slot')::int;
    hand_i := (p_move->>'hand')::int;
    if phase = 'place1' and slot not between 0 and 3 then raise exception 'That slot is closed.'; end if;
    if phase = 'place2' and slot not between 4 and 6 then raise exception 'That slot is closed.'; end if;
    if phase not in ('place1', 'place2') then raise exception 'You cannot place a card now.'; end if;
    side := st->seat;
    board := side->'board';
    hand := side->'hand';
    if board->slot is not null and board->slot <> 'null'::jsonb then raise exception 'That slot is full.'; end if;
    if hand_i is null or hand_i < 0 or hand_i >= jsonb_array_length(hand) then raise exception 'Pick a card in your hand.'; end if;
    card := hand->hand_i;
    newhand := '[]'::jsonb;
    ord := 0;
    for elem in select value from jsonb_array_elements(hand) loop
      if ord <> hand_i then newhand := newhand || jsonb_build_array(elem); end if;
      ord := ord + 1;
    end loop;
    board := jsonb_set(board, array[slot::text], card, true);
    side := jsonb_set(jsonb_set(side, '{hand}', newhand, true), '{board}', board, true);
    st := jsonb_set(st, array[seat], side, true);
    filled := public.pvp_slots_full(st, phase);
    if m.is_bot then
      if not public.seat_phase_full(st, seat, phase) then
        st := jsonb_set(st, '{turn}', to_jsonb(seat), false);
      elsif not public.seat_phase_full(st, opp, phase) then
        st := jsonb_set(st, '{turn}', to_jsonb(opp), false);
      elsif phase = 'place1' then
        st := jsonb_set(st, '{phase}', '"discard"', false);
        st := jsonb_set(st, '{turn}', '"host"', false);
      else
        st := jsonb_set(st, '{phase}', '"swap"', false);
        st := jsonb_set(st, '{turn}', '"host"', false);
      end if;
    elsif filled and phase = 'place1' then
      st := jsonb_set(st, '{phase}', '"discard"', false);
      st := jsonb_set(st, '{turn}', '"host"', false);
    elsif filled and phase = 'place2' then
      st := jsonb_set(st, '{phase}', '"silver"', false);
      st := jsonb_set(st, '{turn}', '"host"', false);
    else
      st := jsonb_set(st, '{turn}', to_jsonb(opp), false);
    end if;
  elsif (p_move->>'t') = 'discard' then
    if phase <> 'discard' then raise exception 'You cannot discard now.'; end if;
    if coalesce((st->seat->>'discarded')::boolean, false) then raise exception 'You already discarded.'; end if;
    select coalesce(array_agg(distinct (value)::int), '{}') into idxs
    from jsonb_array_elements_text(coalesce(p_move->'idx', '[]'::jsonb));
    if coalesce(array_length(idxs, 1), 0) > 2 then raise exception 'Discard up to 2 cards.'; end if;
    side := st->seat;
    hand := side->'hand';
    if idxs is not null then
      foreach i in array idxs loop
        if i < 0 or i >= jsonb_array_length(hand) then raise exception 'That card is not in your hand.'; end if;
      end loop;
      newhand := '[]'::jsonb;
      ord := 0;
      for elem in select value from jsonb_array_elements(hand) loop
        if not (ord = any(idxs)) then newhand := newhand || jsonb_build_array(elem); end if;
        ord := ord + 1;
      end loop;
      hand := newhand;
    end if;
    draw := side->'deck';
    while jsonb_array_length(hand) < 6 and jsonb_array_length(draw) > 0 loop
      hand := hand || jsonb_build_array(draw->0);
      draw := draw - 0;
    end loop;
    side := jsonb_set(jsonb_set(jsonb_set(side, '{hand}', hand, true), '{deck}', draw, true), '{discarded}', 'true'::jsonb, true);
    st := jsonb_set(st, array[seat], side, true);
    if coalesce((st->opp->>'discarded')::boolean, false) then
      st := jsonb_set(st, '{phase}', '"place2"', false);
      st := jsonb_set(st, '{turn}', '"host"', false);
    else
      st := jsonb_set(st, '{turn}', to_jsonb(opp), false);
    end if;
  elsif (p_move->>'t') = 'swap' then
    if phase <> 'swap' then raise exception 'You cannot swap now.'; end if;
    if coalesce((st->seat->>'swapped')::boolean, false) then raise exception 'You already chose.'; end if;
    side := st->seat;
    hand := side->'hand';
    board := side->'board';
    if p_move ? 'hand' and nullif(p_move->>'hand', '') is not null then
      hand_i := (p_move->>'hand')::int;
      if hand_i < 0 or hand_i >= coalesce(jsonb_array_length(hand), 0) then raise exception 'That card is not in your hand.'; end if;
      card := board->6;
      elem := hand->hand_i;
      newhand := '[]'::jsonb;
      ord := 0;
      for elem in select value from jsonb_array_elements(hand) loop
        if ord = hand_i then newhand := newhand || jsonb_build_array(card);
        else newhand := newhand || jsonb_build_array(elem); end if;
        ord := ord + 1;
      end loop;
      -- elem was overwritten by the loop; take the chosen card again
      elem := hand->hand_i;
      board := jsonb_set(board, '{6}', elem, true);
      side := jsonb_set(jsonb_set(jsonb_set(jsonb_set(side, '{hand}', newhand, true), '{board}', board, true), '{penalty}', '10'::jsonb, true), '{swapped}', 'true'::jsonb, true);
    else
      side := jsonb_set(jsonb_set(side, '{penalty}', '0'::jsonb, true), '{swapped}', 'true'::jsonb, true);
    end if;
    st := jsonb_set(st, array[seat], side, true);
    if coalesce((st->opp->>'swapped')::boolean, false) then
      st := jsonb_set(st, '{phase}', '"silver"', false);
      st := jsonb_set(st, '{turn}', '"host"', false);
    else
      st := jsonb_set(st, '{turn}', to_jsonb(opp), false);
    end if;
  elsif (p_move->>'t') = 'silver' then
    if phase <> 'silver' then raise exception 'Silver is not being chosen.'; end if;
    if coalesce((st->seat->>'silverDone')::boolean, false) then raise exception 'You already chose.'; end if;
    side := jsonb_set(jsonb_set(st->seat, '{silver}', coalesce(p_move->'color', 'null'::jsonb), true), '{silverDone}', 'true'::jsonb, true);
    st := jsonb_set(st, array[seat], side, true);
    if coalesce((st->opp->>'silverDone')::boolean, false) then
      st := jsonb_set(st, '{phase}', '"score"', false);
      st := st - 'turn';
    else
      st := jsonb_set(st, '{turn}', to_jsonb(opp), false);
    end if;
  else
    raise exception 'Unknown move.';
  end if;
  st := jsonb_set(st, '{seq}', to_jsonb(coalesce((st->>'seq')::int, 0) + 1), true);
  if seat = 'host' then m.host_seen := now(); else m.guest_seen := now(); end if;
  update public.matches set
    state = st,
    moves = moves || jsonb_build_array(p_move || jsonb_build_object('seat', seat, 'at', now())),
    turn_deadline = case when st->>'phase' = 'score' then null else now() + interval '90 seconds' end,
    host_seen = m.host_seen,
    guest_seen = case when seat = 'guest' then now() else guest_seen end,
    updated_at = now()
  where id = m.id;
  return jsonb_build_object('ok', true, 'state', st);
end;
$function$;


CREATE OR REPLACE FUNCTION public.bot_play(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m public.matches;
  st jsonb;
  phase text;
  side jsonb;
  hand jsonb;
  board jsonb;
  draw jsonb;
  newhand jsonb;
  elem jsonb;
  best jsonb;
  best_score int;
  score int;
  i int;
  n int;
  slot int;
  hand_i int;
  dropped boolean;
  cid text;
  pts int;
  col text;
  arch text;
  goal text;
  tier text;
  on_board text[] := '{}';
  rng bigint;
begin
  select * into m from public.matches where id = p_id for update;
  if m.id is null or not m.is_bot or m.status <> 'active' then return; end if;
  st := m.state;
  if st->>'turn' is distinct from 'guest' then return; end if;
  phase := st->>'phase';
  tier := coalesce((public.rating_band(coalesce(m.bot_rating, 1000))->>'tier'), 'Bronze');
  side := st->'guest';
  hand := side->'hand';
  board := side->'board';
  rng := public.pvp_rng(coalesce(m.seed, 1)::bigint + coalesce((st->>'seq')::int, 0));
  select c.color into goal from public.cards c where c.id = side->'goal'->>'id';
  for i in 0..6 loop
    cid := board->i->>'id';
    if cid is not null then on_board := on_board || cid; end if;
  end loop;
  if phase in ('place1', 'place2') then
    loop
    best_score := -1;
    n := coalesce(jsonb_array_length(hand), 0);
    if n > 0 then
      for hand_i in 0..n-1 loop
        cid := hand->hand_i->>'id';
        select c.pts, c.color, c.archetype into pts, col, arch from public.cards c where c.id = cid;
        if pts is null then continue; end if;
        score := case
          when tier = 'Bronze' then (rng % 100)::int
          when tier = 'Silver' then pts
          else pts + case when col = goal then 20 else 0 end
            + case when tier in ('Platinum', 'Diamond', 'Champion') and arch = any(
                select c2.archetype from public.cards c2 where c2.id = any(on_board)
              ) then 12 else 0 end
            + case when tier in ('Diamond', 'Champion') and cid = any(on_board) then -30 else 0 end
        end;
        if tier = 'Champion' then score := score + pts; end if;
        if score > best_score then best_score := score; best := hand->hand_i; end if;
        rng := public.pvp_rng(rng);
      end loop;
    end if;
    if best is null then return; end if;
    slot := null;
    for i in (case when phase = 'place1' then 0 else 4 end)..(case when phase = 'place1' then 3 else 6 end) loop
      if board->i is null or board->i = 'null'::jsonb then slot := i; exit; end if;
    end loop;
    if slot is null then return; end if;
    newhand := '[]'::jsonb;
    dropped := false;
    for elem in select value from jsonb_array_elements(hand) loop
      if not dropped and elem = best then dropped := true;
      else newhand := newhand || jsonb_build_array(elem); end if;
    end loop;
    board := jsonb_set(board, array[slot::text], best, true);
    side := jsonb_set(jsonb_set(side, '{hand}', newhand, true), '{board}', board, true);
    st := jsonb_set(st, '{guest}', side, true);
    if not public.seat_phase_full(st, 'guest', phase) then
      side := st->'guest';
      hand := side->'hand';
      board := side->'board';
      on_board := '{}';
      for i in 0..6 loop
        cid := board->i->>'id';
        if cid is not null then on_board := on_board || cid; end if;
      end loop;
      continue;
    end if;
    if public.pvp_slots_full(st, phase) and phase = 'place1' then
      st := jsonb_set(jsonb_set(st, '{phase}', '"discard"', false), '{turn}', '"host"', false);
    elsif public.pvp_slots_full(st, phase) and phase = 'place2' then
      st := jsonb_set(jsonb_set(st, '{phase}', '"swap"', false), '{turn}', '"host"', false);
    else
      st := jsonb_set(st, '{turn}', '"host"', false);
    end if;
    exit;
    end loop;
  elsif phase = 'swap' then
    if coalesce((side->>'swapped')::boolean, false) then return; end if;
    side := st->'guest';
    hand := side->'hand';
    board := side->'board';
    best := null;
    best_score := coalesce((select c.pts from public.cards c where c.id = board->6->>'id'), -1);
    if tier <> 'Bronze' then
      n := coalesce(jsonb_array_length(hand), 0);
      if n > 0 then
        for hand_i in 0..n-1 loop
          select c.pts into pts from public.cards c where c.id = hand->hand_i->>'id';
          if pts is not null and pts > best_score then best_score := pts; best := hand->hand_i; end if;
        end loop;
      end if;
    end if;
    if best is not null then
      newhand := '[]'::jsonb;
      dropped := false;
      for elem in select value from jsonb_array_elements(hand) loop
        if not dropped and elem = best then dropped := true;
        else newhand := newhand || jsonb_build_array(elem); end if;
      end loop;
      newhand := newhand || jsonb_build_array(board->6);
      board := jsonb_set(board, '{6}', best, true);
      side := jsonb_set(jsonb_set(jsonb_set(jsonb_set(side, '{hand}', newhand, true), '{board}', board, true), '{penalty}', '10'::jsonb, true), '{swapped}', 'true'::jsonb, true);
    else
      side := jsonb_set(jsonb_set(side, '{penalty}', '0'::jsonb, true), '{swapped}', 'true'::jsonb, true);
    end if;
    st := jsonb_set(st, '{guest}', side, true);
    if coalesce((st->'host'->>'swapped')::boolean, false) then
      st := jsonb_set(jsonb_set(st, '{phase}', '"silver"', false), '{turn}', '"host"', false);
    else
      st := jsonb_set(st, '{turn}', '"host"', false);
    end if;
  elsif phase = 'discard' then
    if coalesce((side->>'discarded')::boolean, false) then return; end if;
    newhand := '[]'::jsonb;
    best := null;
    if tier <> 'Bronze' and coalesce(jsonb_array_length(hand), 0) > 0 then
      select e.value into best
      from jsonb_array_elements(hand) with ordinality as e(value, ordinality)
      order by coalesce((select c.pts from public.cards c where c.id = e.value->>'id'), 99), e.ordinality
      limit 1;
    end if;
    dropped := false;
    for elem in select value from jsonb_array_elements(hand) loop
      if best is not null and not dropped and elem = best then dropped := true;
      else newhand := newhand || jsonb_build_array(elem); end if;
    end loop;
    draw := side->'deck';
    while jsonb_array_length(newhand) < 6 and jsonb_array_length(coalesce(draw, '[]'::jsonb)) > 0 loop
      newhand := newhand || jsonb_build_array(draw->0);
      draw := draw - 0;
    end loop;
    side := jsonb_set(jsonb_set(jsonb_set(side, '{hand}', newhand, true), '{deck}', coalesce(draw, '[]'::jsonb), true), '{discarded}', 'true'::jsonb, true);
    st := jsonb_set(st, '{guest}', side, true);
    if coalesce((st->'host'->>'discarded')::boolean, false) then
      st := jsonb_set(jsonb_set(st, '{phase}', '"place2"', false), '{turn}', '"host"', false);
    else
      st := jsonb_set(st, '{turn}', '"host"', false);
    end if;
  elsif phase = 'silver' then
    if coalesce((side->>'silverDone')::boolean, false) then return; end if;
    col := coalesce(goal, 'red');
    if tier in ('Bronze', 'Silver') then
      select c.color into col from public.cards c
      where c.id in (select value->>'id' from jsonb_array_elements(board))
        and c.color not in ('black', 'silver')
      group by c.color order by count(*) desc, c.color limit 1;
      col := coalesce(col, 'red');
    elsif tier = 'Champion' and goal is not null and goal not in ('black', 'silver') then
      col := goal;
    end if;
    side := jsonb_set(jsonb_set(side, '{silver}', to_jsonb(col), true), '{silverDone}', 'true'::jsonb, true);
    st := jsonb_set(st, '{guest}', side, true);
    if coalesce((st->'host'->>'silverDone')::boolean, false) then
      st := jsonb_set(st, '{phase}', '"score"', false);
      st := st - 'turn';
    else
      st := jsonb_set(st, '{turn}', '"host"', false);
    end if;
  else
    return;
  end if;
  st := jsonb_set(st, '{seq}', to_jsonb(coalesce((st->>'seq')::int, 0) + 1), true);
  update public.matches set
    state = st,
    moves = moves || jsonb_build_array(jsonb_build_object('t', 'bot', 'seat', 'guest', 'at', now())),
    turn_deadline = case when st->>'phase' = 'score' then null else now() + interval '90 seconds' end,
    guest_seen = now(),
    updated_at = now()
  where id = m.id;
end;
$function$;



create or replace function public.ranked_winner(p_state jsonb)
returns text language sql volatile security definer set search_path = public as $$
  select public.engine_score(p_state)->>'winner';
$$;

create or replace function public.bump_bot_clock(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
begin
  update public.matches set turn_deadline = now() + interval '90 seconds', updated_at = now()
  where id = p_match and is_bot and status = 'active' and host = uid and state->>'turn' = 'host';
end;
$$;

revoke all on function public.bump_bot_clock(uuid) from public, anon;
grant execute on function public.bump_bot_clock(uuid) to authenticated;
