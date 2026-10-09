# TODO

- [ ] **Opravit výpočet změn za 7 a 30 dní.** `computeChange` nyní porovnává záznamy podle pozice, ne podle data. Při výpadku denního sběru proto „7d“ a „30d“ mohou představovat delší interval. Vyhledávat záznam podle kalendářního data a určit chování při chybějícím dni (např. zobrazit pomlčku).
- [ ] **Refaktorovat kód pro testování.** Oddělit výpočty, validaci a parsování do samostatných modulů.
- [ ] **Napsat unit testy v JavaScriptu.** Pokrýt výpočty intervalů včetně chybějících dní, validaci a řazení dat, převody počtů recenzí a parsování Google Play. Použít vestavěný testovací nástroj Node.js; nastavit spouštění v GitHub Actions při pushi a pull requestu.
