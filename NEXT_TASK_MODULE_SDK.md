# Nächster Auftrag für Claude Code – PULSE

## Schritt 0 – Sicherheits-Fix vor weiterer autonomer Arbeit

Prüfe .claude/settings.local.json in diesem Repo.
Die Berechtigungsdatei ist laut letzter Bestandsaufnahme schmaler als der
eigentlich vorgesehene Regelsatz: "git push *" ist aktuell breit freigegeben,
ein explizites Ask-Override für Force-Push fehlt. Korrigiere das (Force-Push
und destruktive Git-Operationen müssen explizit bestätigt werden), zeig mir
den Diff zur Freigabe, bevor du fortfährst.

## Schritt 1 – Module SDK gemäß Decision #7 (Referenzquelle: CLAUDE.md)

Lies zuerst CLAUDE.md sowie den bestehenden ModuleDescriptor /
MODULE_DESCRIPTORS-Mechanismus und das Calendar-Modul (aktuell einzige volle
Referenzimplementierung eines Moduls) in diesem Repo.

Entwirf danach ein kurzes Design-Dokument (kein Code) fuer den echten,
versionierten Module SDK, das mindestens folgende Punkte verbindlich klaert
und abdeckt:
- Versionierung von Modulen und Kompatibilitaetsregeln
- Lifecycle (Registrierung, Aktivierung, Deaktivierung, Deinstallation)
- modul-eigene Schemas und Migrationen (isoliert vom Core-Schema)
- Isolation zwischen Modulen (Fehler/Crash eines Moduls darf Core nicht gefaehrden)
- Capability Contracts (was ein Modul deklarieren/anfordern darf)
- Modul-zu-Modul-Kommunikation und Events
- APIs und Berechtigungen pro Modul
- identische SDK-Behandlung fuer First- und Third-Party-Module
- Compile-Time- vs. Dynamic-Loading-Entscheidung (offene Frage)

Lege mir das Design zur Review vor, bevor du zu implementieren beginnst.

## Harte Leitplanken – NICHT tun, auch nicht andeutungsweise

- keine Implementierung von Decision #11 (Responsibility & Routing)
- kein Content Coordination Modul
- keine External Intelligence / Action Request
- keine Customer/AssistiveDevice-Migration nach Decision #10
- kein OIDC/MFA/Recovery, kein Relay
- kein Ausbau von Dev Console oder Desktop-/Mobile-Client

## Nach Freigabe des Designs

Implementierung schrittweise mit Tests, danach das bestehende Calendar-Modul
als Proof of Concept auf den neuen SDK migrieren.
