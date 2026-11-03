-- Mythic Vault: 60 player-obtainable Mythic cards (my_*), extended combos, and one premium pack.
-- Not applied. Review this file, then run it in the Supabase SQL editor.
-- Regular packs stay on pack_pool and never drop my_* cards.
-- Mythic Vault costs 900 coins and contains 5 cards. 4% of packs replace one
-- slot with a Mythic card. The other slots are the standard pool, including
-- commons, with a small weight bump for Rare and Legendary (12 vs 10).
-- Hosted Supabase rejects DELETE and UPDATE with no WHERE. This file does not add one.
-- Obsidian (ob_* / admin_only) rules are unchanged.


insert into public.cards (id, name, archetype, color, pts, pack_pool, admin_only) values
('my_vellum', 'Vellum Starling', 'Mythic', 'red', 8, false, false),
('my_quill', 'Quill of Comet', 'Mythic', 'red', 9, false, false),
('my_brass', 'Brass Halo', 'Mythic', 'red', 7, false, false),
('my_lumen', 'Lumen Bell', 'Mythic', 'red', 10, false, false),
('my_puck', 'Puck Orbit', 'Mythic', 'red', 8, false, false),
('my_nimbus', 'Nimbus June', 'Mythic', 'red', 7, false, false),
('my_cinder', 'Cinder Vale', 'Mythic', 'red', 9, false, false),
('my_marble', 'Marble Echo', 'Mythic', 'red', 8, false, false),
('my_thistle', 'Thimble Thistle', 'Mythic', 'orange', 8, false, false),
('my_cobalt', 'Cobalt Wren', 'Mythic', 'orange', 9, false, false),
('my_saffron', 'Saffron Pike', 'Mythic', 'orange', 7, false, false),
('my_ivory', 'Ivory Lark', 'Mythic', 'orange', 10, false, false),
('my_jasper', 'Jasper Mote', 'Mythic', 'orange', 8, false, false),
('my_indigo', 'Indigo Pebble', 'Mythic', 'orange', 7, false, false),
('my_fern', 'Fern Quasar', 'Mythic', 'orange', 9, false, false),
('my_rook', 'Rook Lantern', 'Mythic', 'orange', 8, false, false),
('my_pippin', 'Pippin Gale', 'Mythic', 'yellow', 8, false, false),
('my_opal', 'Opal Drift', 'Mythic', 'yellow', 9, false, false),
('my_flint', 'Flint Hush', 'Mythic', 'yellow', 7, false, false),
('my_coral', 'Coral Vesper', 'Mythic', 'yellow', 10, false, false),
('my_moss', 'Moss Banner', 'Mythic', 'yellow', 8, false, false),
('my_pewter', 'Pewter Grin', 'Mythic', 'yellow', 7, false, false),
('my_amber', 'Amber Knoll', 'Mythic', 'yellow', 9, false, false),
('my_violet', 'Violet Yard', 'Mythic', 'yellow', 8, false, false),
('my_cedar', 'Cedar Blink', 'Mythic', 'purple', 8, false, false),
('my_honey', 'Honey Axis', 'Mythic', 'purple', 9, false, false),
('my_slate', 'Slate Moth', 'Mythic', 'purple', 7, false, false),
('my_pearl', 'Pearl Tumble', 'Mythic', 'purple', 10, false, false),
('my_rust', 'Rust Parade', 'Mythic', 'purple', 8, false, false),
('my_kelp', 'Kelp Sonnet', 'Mythic', 'purple', 7, false, false),
('my_topaz', 'Topaz Nib', 'Mythic', 'purple', 9, false, false),
('my_lilac', 'Lilac Drum', 'Mythic', 'purple', 8, false, false),
('my_birch', 'Birch Comet', 'Mythic', 'green', 8, false, false),
('my_ginger', 'Ginger Vault', 'Mythic', 'green', 9, false, false),
('my_onyx', 'Onyx Tick', 'Mythic', 'green', 7, false, false),
('my_silverling', 'Silverling Bo', 'Mythic', 'green', 10, false, false),
('my_crimson', 'Crimson Loft', 'Mythic', 'green', 8, false, false),
('my_apricot', 'Apricot Coil', 'Mythic', 'green', 7, false, false),
('my_lemon', 'Lemon Spire', 'Mythic', 'green', 9, false, false),
('my_plum', 'Plum Harbor', 'Mythic', 'blue', 8, false, false),
('my_clover', 'Clover Hex', 'Mythic', 'blue', 8, false, false),
('my_navy', 'Navy Pollen', 'Mythic', 'blue', 9, false, false),
('my_ink', 'Ink Carnival', 'Mythic', 'blue', 7, false, false),
('my_mist', 'Mist Fable', 'Mythic', 'blue', 10, false, false),
('my_poppy', 'Poppy Gear', 'Mythic', 'blue', 8, false, false),
('my_mango', 'Mango Relic', 'Mythic', 'blue', 7, false, false),
('my_yarrow', 'Yarrow Chime', 'Mythic', 'black', 9, false, false),
('my_orchid', 'Orchid Pike', 'Mythic', 'black', 8, false, false),
('my_basil', 'Basil North', 'Mythic', 'black', 8, false, false),
('my_tide', 'Tide Marquee', 'Mythic', 'black', 9, false, false),
('my_soot', 'Soot Ribbon', 'Mythic', 'black', 7, false, false),
('my_quartz', 'Quartz Jig', 'Mythic', 'black', 10, false, false),
('my_scarlet', 'Scarlet Umbrella', 'Mythic', 'black', 8, false, false),
('my_pumpkin', 'Pumpkin Relay', 'Mythic', 'silver', 7, false, false),
('my_daffodil', 'Daffodil Bolt', 'Mythic', 'silver', 9, false, false),
('my_mauve', 'Mauve Picnic', 'Mythic', 'silver', 8, false, false),
('my_willow', 'Willow Kite', 'Mythic', 'silver', 8, false, false),
('my_lagoon', 'Lagoon Mime', 'Mythic', 'silver', 9, false, false),
('my_char', 'Char Lullaby', 'Mythic', 'silver', 7, false, false),
('my_frost', 'Frost Ticket', 'Mythic', 'silver', 10, false, false)
on conflict (id) do update set name = excluded.name, archetype = excluded.archetype, color = excluded.color, pts = excluded.pts, pack_pool = excluded.pack_pool, admin_only = excluded.admin_only;

insert into public.card_rules (id, char_name, grp, archetype, features, powers, wild) values
('my_vellum', 'Vellum', 'Mythic Vault', 'Mythic', array['Female','Hero']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Quill"}}}]'::jsonb, false),
('my_quill', 'Quill', 'Mythic Vault', 'Mythic', array['Male','Hero']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Vellum"}}}]'::jsonb, false),
('my_brass', 'Brass', 'Mythic Vault', 'Mythic', array['Female','Villain']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Lumen"}}}]'::jsonb, false),
('my_lumen', 'Lumen', 'Mythic Vault', 'Mythic', array['Male','Villain']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Brass"}}}]'::jsonb, false),
('my_puck', 'Puck', 'Mythic Vault', 'Mythic', array['Female','Monster']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Nimbus"}}}]'::jsonb, false),
('my_nimbus', 'Nimbus', 'Mythic Vault', 'Mythic', array['Male','Monster']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Puck"}}}]'::jsonb, false),
('my_cinder', 'Cinder', 'Mythic Vault', 'Mythic', array['Animal','Hero']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Marble"}}}]'::jsonb, false),
('my_marble', 'Marble', 'Mythic Vault', 'Mythic', array['Prop']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Cinder"}}}]'::jsonb, false),
('my_thistle', 'Thimble', 'Mythic Vault', 'Mythic', array['Female','Hero']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Cobalt"}}}]'::jsonb, false),
('my_cobalt', 'Cobalt', 'Mythic Vault', 'Mythic', array['Male','Hero']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Thimble"}}}]'::jsonb, false),
('my_saffron', 'Saffron', 'Mythic Vault', 'Mythic', array['Female','Villain']::text[], '[{"type":"boost","op":"add","n":4,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Ivory"}}}]'::jsonb, false),
('my_ivory', 'Ivory', 'Mythic Vault', 'Mythic', array['Male','Villain']::text[], '[{"type":"boost","op":"mul","n":2,"who":"self","cond":{"kind":"nextTo","filter":{"char":"Saffron"}}}]'::jsonb, false),
('my_jasper', 'Jasper', 'Mythic Vault', 'Mythic', array['Female','Monster']::text[], '[{"type":"boost","op":"add","n":2,"who":"allOther","filter":{"group":"Mythic Vault"}}]'::jsonb, false),
('my_indigo', 'Indigo', 'Mythic Vault', 'Mythic', array['Male','Monster']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"color":"orange"}}]'::jsonb, false),
('my_fern', 'Fern', 'Mythic Vault', 'Mythic', array['Animal','Hero']::text[], '[{"type":"boost","op":"add","n":-3,"who":"opposite"}]'::jsonb, false),
('my_rook', 'Rook', 'Mythic Vault', 'Mythic', array['Prop']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"where":"inPlay","filter":{"feature":"Hero"}}}]'::jsonb, false),
('my_pippin', 'Pippin', 'Mythic Vault', 'Mythic', array['Female','Hero']::text[], '[{"type":"recolor","color":"yellow","who":"neighbors"},{"type":"boost","op":"add","n":2,"who":"self"}]'::jsonb, false),
('my_opal', 'Opal', 'Mythic Vault', 'Mythic', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"distinct":"archetype","where":"ownSide"}}]'::jsonb, false),
('my_flint', 'Flint', 'Mythic Vault', 'Mythic', array['Female','Villain']::text[], '[{"type":"boost","op":"add","n":2,"who":"allOther","filter":{"group":"Mythic Vault"}}]'::jsonb, false),
('my_coral', 'Coral', 'Mythic Vault', 'Mythic', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"color":"yellow"}}]'::jsonb, false),
('my_moss', 'Moss', 'Mythic Vault', 'Mythic', array['Female','Monster']::text[], '[{"type":"boost","op":"add","n":-3,"who":"opposite"}]'::jsonb, false),
('my_pewter', 'Pewter', 'Mythic Vault', 'Mythic', array['Male','Monster']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"where":"inPlay","filter":{"feature":"Hero"}}}]'::jsonb, false),
('my_amber', 'Amber', 'Mythic Vault', 'Mythic', array['Animal','Hero']::text[], '[{"type":"recolor","color":"yellow","who":"neighbors"},{"type":"boost","op":"add","n":2,"who":"self"}]'::jsonb, false),
('my_violet', 'Violet', 'Mythic Vault', 'Mythic', array['Prop']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"distinct":"archetype","where":"ownSide"}}]'::jsonb, false),
('my_cedar', 'Cedar', 'Mythic Vault', 'Mythic', array['Female','Hero']::text[], '[{"type":"boost","op":"add","n":2,"who":"allOther","filter":{"group":"Mythic Vault"}}]'::jsonb, false),
('my_honey', 'Honey', 'Mythic Vault', 'Mythic', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"color":"purple"}}]'::jsonb, false),
('my_slate', 'Slate', 'Mythic Vault', 'Mythic', array['Female','Villain']::text[], '[{"type":"boost","op":"add","n":-3,"who":"opposite"}]'::jsonb, false),
('my_pearl', 'Pearl', 'Mythic Vault', 'Mythic', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"where":"inPlay","filter":{"feature":"Hero"}}}]'::jsonb, false),
('my_rust', 'Rust', 'Mythic Vault', 'Mythic', array['Female','Monster']::text[], '[{"type":"recolor","color":"purple","who":"neighbors"},{"type":"boost","op":"add","n":2,"who":"self"}]'::jsonb, false),
('my_kelp', 'Kelp', 'Mythic Vault', 'Mythic', array['Male','Monster']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"distinct":"archetype","where":"ownSide"}}]'::jsonb, false),
('my_topaz', 'Topaz', 'Mythic Vault', 'Mythic', array['Animal','Hero']::text[], '[{"type":"boost","op":"add","n":2,"who":"allOther","filter":{"group":"Mythic Vault"}}]'::jsonb, false),
('my_lilac', 'Lilac', 'Mythic Vault', 'Mythic', array['Prop']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"color":"purple"}}]'::jsonb, false),
('my_birch', 'Birch', 'Mythic Vault', 'Mythic', array['Female','Hero']::text[], '[{"type":"boost","op":"add","n":-3,"who":"opposite"}]'::jsonb, false),
('my_ginger', 'Ginger', 'Mythic Vault', 'Mythic', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"where":"inPlay","filter":{"feature":"Hero"}}}]'::jsonb, false),
('my_onyx', 'Onyx', 'Mythic Vault', 'Mythic', array['Female','Villain']::text[], '[{"type":"recolor","color":"green","who":"neighbors"},{"type":"boost","op":"add","n":2,"who":"self"}]'::jsonb, false),
('my_silverling', 'Silverling', 'Mythic Vault', 'Mythic', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"distinct":"archetype","where":"ownSide"}}]'::jsonb, false),
('my_crimson', 'Crimson', 'Mythic Vault', 'Mythic', array['Female','Monster']::text[], '[{"type":"boost","op":"add","n":2,"who":"allOther","filter":{"group":"Mythic Vault"}}]'::jsonb, false),
('my_apricot', 'Apricot', 'Mythic Vault', 'Mythic', array['Male','Monster']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"color":"green"}}]'::jsonb, false),
('my_lemon', 'Lemon', 'Mythic Vault', 'Mythic', array['Animal','Hero']::text[], '[{"type":"boost","op":"add","n":-3,"who":"opposite"}]'::jsonb, false),
('my_plum', 'Plum', 'Mythic Vault', 'Mythic', array['Prop']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"where":"inPlay","filter":{"feature":"Hero"}}}]'::jsonb, false),
('my_clover', 'Clover', 'Mythic Vault', 'Mythic', array['Female','Hero']::text[], '[{"type":"recolor","color":"blue","who":"neighbors"},{"type":"boost","op":"add","n":2,"who":"self"}]'::jsonb, false),
('my_navy', 'Navy', 'Mythic Vault', 'Mythic', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"distinct":"archetype","where":"ownSide"}}]'::jsonb, false),
('my_ink', 'Ink', 'Mythic Vault', 'Mythic', array['Female','Villain']::text[], '[{"type":"boost","op":"add","n":2,"who":"allOther","filter":{"group":"Mythic Vault"}}]'::jsonb, false),
('my_mist', 'Mist', 'Mythic Vault', 'Mythic', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"color":"blue"}}]'::jsonb, false),
('my_poppy', 'Poppy', 'Mythic Vault', 'Mythic', array['Female','Monster']::text[], '[{"type":"boost","op":"add","n":-3,"who":"opposite"}]'::jsonb, false),
('my_mango', 'Mango', 'Mythic Vault', 'Mythic', array['Male','Monster']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"where":"inPlay","filter":{"feature":"Hero"}}}]'::jsonb, false),
('my_yarrow', 'Yarrow', 'Mythic Vault', 'Mythic', array['Animal','Hero']::text[], '[{"type":"recolor","color":"black","who":"neighbors"},{"type":"boost","op":"add","n":2,"who":"self"}]'::jsonb, false),
('my_orchid', 'Orchid', 'Mythic Vault', 'Mythic', array['Prop']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"distinct":"archetype","where":"ownSide"}}]'::jsonb, false),
('my_basil', 'Basil', 'Mythic Vault', 'Mythic', array['Female','Hero']::text[], '[{"type":"boost","op":"add","n":2,"who":"allOther","filter":{"group":"Mythic Vault"}}]'::jsonb, false),
('my_tide', 'Tide', 'Mythic Vault', 'Mythic', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"color":"black"}}]'::jsonb, false),
('my_soot', 'Soot', 'Mythic Vault', 'Mythic', array['Female','Villain']::text[], '[{"type":"boost","op":"add","n":-3,"who":"opposite"}]'::jsonb, false),
('my_quartz', 'Quartz', 'Mythic Vault', 'Mythic', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"where":"inPlay","filter":{"feature":"Hero"}}}]'::jsonb, false),
('my_scarlet', 'Scarlet', 'Mythic Vault', 'Mythic', array['Female','Monster']::text[], '[{"type":"recolor","color":"black","who":"neighbors"},{"type":"boost","op":"add","n":2,"who":"self"}]'::jsonb, false),
('my_pumpkin', 'Pumpkin', 'Mythic Vault', 'Mythic', array['Male','Monster']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"distinct":"archetype","where":"ownSide"}}]'::jsonb, false),
('my_daffodil', 'Daffodil', 'Mythic Vault', 'Mythic', array['Animal','Hero']::text[], '[{"type":"boost","op":"add","n":2,"who":"allOther","filter":{"group":"Mythic Vault"}}]'::jsonb, false),
('my_mauve', 'Mauve', 'Mythic Vault', 'Mythic', array['Prop']::text[], '[{"type":"boost","op":"add","n":3,"who":"neighbors","filter":{"color":"silver"}}]'::jsonb, false),
('my_willow', 'Willow', 'Mythic Vault', 'Mythic', array['Female','Hero']::text[], '[{"type":"boost","op":"add","n":-3,"who":"opposite"}]'::jsonb, false),
('my_lagoon', 'Lagoon', 'Mythic Vault', 'Mythic', array['Male','Hero']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"where":"inPlay","filter":{"feature":"Hero"}}}]'::jsonb, false),
('my_char', 'Char', 'Mythic Vault', 'Mythic', array['Female','Villain']::text[], '[{"type":"recolor","color":"silver","who":"neighbors"},{"type":"boost","op":"add","n":2,"who":"self"}]'::jsonb, false),
('my_frost', 'Frost', 'Mythic Vault', 'Mythic', array['Male','Villain']::text[], '[{"type":"boost","op":"add","n":1,"who":"self","each":{"distinct":"archetype","where":"ownSide"}}]'::jsonb, false)
on conflict (id) do update set char_name = excluded.char_name, grp = excluded.grp, archetype = excluded.archetype, features = excluded.features, powers = excluded.powers, wild = excluded.wild;

insert into public.combo_pairs (id, name, a, b, bonus) values
('scale_school', 'Scale School', 'Dragons', 'Wizards', 3),
('star_guard', 'Star Guard', 'Knights', 'Galaxy', 3),
('ghost_ship', 'Ghost Ship', 'Pirates', 'Ghosts', 3),
('clockwork', 'Clockwork Shadow', 'Robots', 'Ninjas', 3),
('harvest', 'Harvest Pact', 'Barnyard', 'Sprouts', 3),
('fossil_flame', 'Fossil Flame', 'Dinos', 'Dragons', 3),
('premiere_orbit', 'Premiere Orbit', 'Toons', 'Galaxy', 3),
('grave_study', 'Grave Study', 'Undead', 'Wizards', 3),
('tideglint', 'Tideglint', 'Sea Creatures', 'Fairies', 3),
('ember_oath', 'Ember Oath', 'Elementals', 'Knights', 3),
('burrow_bloom', 'Burrow Bloom', 'Critters', 'Sprouts', 3),
('sweet_circuits', 'Sweet Circuits', 'Candy Folk', 'Robots', 3),
('night_trick', 'Night Trick', 'Spooks', 'Ninjas', 3),
('corsair_guard', 'Corsair Guard', 'Pirates', 'Knights', 3),
('saucer_study', 'Saucer Study', 'Space Aliens', 'Wizards', 3),
('glimmer_haunt', 'Glimmer Haunt', 'Ghosts', 'Fairies', 3),
('stomp_farm', 'Stomp Farm', 'Dinos', 'Barnyard', 3),
('matinee', 'Matinee Mutiny', 'Toons', 'Pirates', 3),
('vault_guard', 'Vault Guard', 'Mythic', 'Knights', 4),
('vault_flame', 'Vault Flame', 'Mythic', 'Dragons', 4),
('vault_orbit', 'Vault Orbit', 'Mythic', 'Galaxy', 4),
('vault_study', 'Vault Study', 'Mythic', 'Wizards', 4)
on conflict (id) do update set name = excluded.name, a = excluded.a, b = excluded.b, bonus = excluded.bonus;

insert into public.combo_sets (id, name, bonus, ids) values
('flame_bumble', 'Flame and Bumble', 6, array['ember','sirbumble']::text[]),
('fumble_storm', 'Fumble Storm', 6, array['fizzwick','blazey']::text[]),
('rum_ink', 'Rum and Ink', 6, array['redbeard','inkwell']::text[]),
('bolt_paw', 'Bolt Paw', 6, array['boltz','kitsu']::text[]),
('harvest_hands', 'Harvest Hands', 6, array['hank','pip']::text[]),
('roar_snap', 'Roar and Snap', 6, array['rexie','ember']::text[]),
('big_premiere', 'Big Premiere', 6, array['mayor','zoomer']::text[]),
('grave_fizz', 'Grave Fizz', 6, array['mumbles','fizzwick']::text[]),
('glimmer_tide', 'Glimmer Tide', 6, array['twinkle','inkwell']::text[]),
('jiggle_circuit', 'Jiggle Circuit', 6, array['gummo','boltz']::text[]),
('fang_step', 'Fang Step', 6, array['fangly','kitsu']::text[]),
('corsair_knight', 'Corsair and Knight', 6, array['redbeard','sirbumble']::text[]),
('starlit_duo', 'Starlit Duo', 8, array['my_vellum','my_quill']::text[]),
('crown_pact', 'Crown Pact', 8, array['my_brass','my_lumen']::text[]),
('lantern_vow', 'Lantern Vow', 8, array['my_puck','my_nimbus']::text[]),
('prism_pair', 'Prism Pair', 8, array['my_cinder','my_marble']::text[]),
('echo_court', 'Echo Court', 8, array['my_thistle','my_cobalt']::text[]),
('halo_twins', 'Halo Twins', 8, array['my_saffron','my_ivory']::text[])
on conflict (id) do update set name = excluded.name, bonus = excluded.bonus, ids = excluded.ids;

-- One weighted draw from the standard pack pool. Rare and Legendary cards
-- weigh 12; Common and Uncommon weigh 10.
create or replace function public.mythic_standard_card()
returns text language sql volatile security definer set search_path = public as $$
  select c.id
  from public.cards c
  where c.pack_pool and not c.admin_only and c.id not like 'my_%' and c.id not like 'ob_%'
  order by -ln(greatest(random(), 1e-9)) / (
    case public.card_rarity(c.pts) when 'Rare' then 12 when 'Legendary' then 12 else 10 end
  )
  limit 1;
$$;

create or replace function public.list_shop_packs()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  bits text := '';
  rec record;
begin
  for rec in
    with pool as (
      select public.card_rarity(c.pts) as band,
        case public.card_rarity(c.pts) when 'Rare' then 12 when 'Legendary' then 12 else 10 end as w
      from public.cards c
      where c.pack_pool and not c.admin_only and c.id not like 'my_%' and c.id not like 'ob_%'
    ), tot as (
      select sum(w)::numeric as s from pool
    )
    select band, round(sum(w) / nullif((select s from tot), 0) * 100, 1) as pct
    from pool
    group by band
    order by case band when 'Common' then 1 when 'Uncommon' then 2 when 'Rare' then 3 else 4 end
  loop
    if bits <> '' then bits := bits || ' · '; end if;
    bits := bits || rec.band || ' ' || trim(to_char(rec.pct, 'FM990.0')) || '%';
  end loop;
  return jsonb_build_array(jsonb_build_object(
    'id', 'mythic',
    'name', 'Mythic Vault',
    'price', 900,
    'size', 5,
    'mythic_pct', 4,
    'lines', jsonb_build_array(
      '5 cards per pack',
      '4% of packs contain 1 Mythic card',
      'Every other card is a standard toon, commons included',
      'Each of those cards: ' || bits
    )
  ));
end;
$$;

create or replace function public.record_notable_pull(p_user uuid, p_card text, p_gold boolean, p_kind text)
returns void language plpgsql security definer set search_path = public as $$
declare
  card_pts int;
  admin_flag boolean;
  band text;
  uname text;
begin
  if p_user is null or p_card is null or p_card = '' or p_card like 'ob_%' then
    return;
  end if;
  select c.pts, c.admin_only into card_pts, admin_flag
  from public.cards c
  where c.id = p_card;
  if admin_flag is null or admin_flag then
    return;
  end if;
  if p_card like 'my_%' then
    band := 'Mythic';
  else
    band := public.card_rarity(card_pts);
    if not coalesce(p_gold, false) and band not in ('Rare', 'Legendary') then
      return;
    end if;
  end if;
  select username into uname from public.profiles where id = p_user;
  if uname is null then
    return;
  end if;
  insert into public.pull_feed (user_id, username, card_id, is_gold, rarity, pack_kind)
  values (p_user, uname, p_card, coalesce(p_gold, false), band, left(coalesce(nullif(p_kind, ''), 'standard'), 40));
  delete from public.pull_feed where created_at < now() - interval '7 days';
  delete from public.pull_feed
  where id in (
    select id from public.pull_feed
    order by created_at desc
    offset 500
  );
end;
$$;

create or replace function public.open_pack(p_mode text, p_theme text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.require_login();
  prof public.profiles;
  price int := 0;
  pool text[];
  unowned text[];
  force_at int := 0;
  i int;
  cid text;
  is_gold boolean;
  had_any boolean;
  gold_bps int := public.setting('gold_chance_bps', 300);
  pulls jsonb := '[]'::jsonb;
  seen text[] := '{}';
  kind text;
  mythic_hit boolean := false;
  mythic_slot int := 0;
begin
  select * into prof from public.profiles where id = uid for update;
  if p_mode = 'inventory' then
    if prof.unopened_packs < 1 then
      raise exception 'No unopened packs.';
    end if;
    update public.profiles set unopened_packs = unopened_packs - 1, packs_opened = packs_opened + 1 where id = uid;
    select coalesce(array_agg(id), '{}') into pool from public.cards where pack_pool and id not like 'my_%';
    kind := 'standard';
  elsif p_mode = 'mythic' then
    price := 900;
    if prof.coins < price then
      raise exception 'Not enough Orbit Coins.';
    end if;
    update public.profiles set coins = coins - price, packs_opened = packs_opened + 1 where id = uid and coins >= price;
    if not found then
      raise exception 'Not enough Orbit Coins.';
    end if;
    select coalesce(array_agg(id), '{}') into pool from public.cards where pack_pool and id not like 'my_%';
    if coalesce(array_length(pool, 1), 0) = 0 then
      raise exception 'That pack is empty.';
    end if;
    mythic_hit := random() < 0.04;
    mythic_slot := 1 + floor(random() * 5)::int;
    kind := 'mythic';
  else
    if p_theme is null or p_theme = '' then
      raise exception 'Pick a themed pack.';
    end if;
    price := public.theme_pack_price(p_theme);
    if prof.coins < price then
      raise exception 'Not enough Orbit Coins.';
    end if;
    select coalesce(array_agg(id), '{}') into pool
    from public.cards where pack_pool and archetype = p_theme and id not like 'my_%';
    if coalesce(array_length(pool, 1), 0) = 0 then
      raise exception 'That pack is empty.';
    end if;
    update public.profiles set coins = coins - price, packs_opened = packs_opened + 1 where id = uid and coins >= price;
    if not found then
      raise exception 'Not enough Orbit Coins.';
    end if;
    kind := p_theme;
  end if;
  if coalesce(array_length(pool, 1), 0) = 0 then
    raise exception 'That pack is empty.';
  end if;
  select coalesce(array_agg(x.id), '{}') into unowned
  from unnest(pool) as x(id)
  where not exists (
    select 1 from public.collection c where c.user_id = uid and c.card_id = x.id and c.count > 0
  );
  if coalesce(array_length(unowned, 1), 0) > 0 then
    force_at := 1 + floor(random() * 5)::int;
  end if;
  for i in 1..5 loop
    if p_mode = 'mythic' and mythic_hit and i = mythic_slot then
      select c.id into cid from public.cards c
      where c.id like 'my_%' and not c.admin_only
      order by random()
      limit 1;
      if cid is null then
        raise exception 'That pack is empty.';
      end if;
    elsif p_mode = 'mythic' and i is distinct from force_at then
      cid := public.mythic_standard_card();
    elsif i = force_at then
      cid := unowned[1 + floor(random() * array_length(unowned, 1))::int];
    else
      cid := pool[1 + floor(random() * array_length(pool, 1))::int];
    end if;
    is_gold := random() < (gold_bps / 10000.0);
    had_any := exists (
      select 1 from public.collection c where c.user_id = uid and c.card_id = cid and c.count > 0
    ) or cid = any(seen);
    perform public.give_copy(uid, cid, is_gold, 1);
    perform public.record_notable_pull(uid, cid, is_gold, kind);
    seen := seen || cid;
    pulls := pulls || jsonb_build_array(jsonb_build_object(
      'id', cid,
      'gold', is_gold,
      'uid', cid || case when is_gold then ':g:' else ':s:' end || i::text,
      'isNew', not had_any
    ));
  end loop;
  return jsonb_build_object('pulls', pulls, 'price', price);
end;
$$;

revoke all on function public.mythic_standard_card() from public, anon, authenticated;
revoke all on function public.list_shop_packs() from public;
grant execute on function public.list_shop_packs() to anon, authenticated;
