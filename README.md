# Cartographie thématique des RPs et partenaires WPHF RDC

Portail interactif de visualisation du portefeuille **Women’s Peace & Humanitarian Fund (WPHF)** accompagné par **ONU Femmes en République démocratique du Congo**.

## Fonctionnalités

- carte interactive de l’Ituri, du Nord-Kivu et du Sud-Kivu ;
- filtres par Outcome, province, thématique et statut ;
- indicateurs et graphiques recalculés dynamiquement ;
- fiches détaillées des 17 partenaires et projets ;
- lecture des financements et contributions liées à Ebola ;
- présentation responsive adaptée aux téléphones, tablettes et ordinateurs ;
- mise en valeur de l’approche d’ONU Femmes : localisation, renforcement institutionnel, protection, paix et réponse adaptative.

## Structure

```text
├── index.html
├── assets/
│   ├── images/
│   └── logos/
├── css/styles.css
├── data/
│   ├── portfolio.json
│   └── cod-adm1.geojson
├── js/app.js
└── .github/workflows/pages.yml
```

## Mise à jour des données

Le fichier `data/portfolio.json` contient le portefeuille consolidé. L’interface recalcule automatiquement les KPI, graphiques, cartes et fiches partenaires lors du chargement.

## Publication

Le workflow GitHub Actions publie automatiquement la branche `main` sur GitHub Pages après chaque mise à jour.

## Crédits

- Données : WPHF DRC 02000494 Outcome 5 et WPHF DRC 02001271 Outcome 6.
- Limites administratives : geoBoundaries COD ADM1.
- Photo de couverture : ONU Femmes / Catianne Tijerina, via WPHF.
- Galerie : AFIA MAMA, via WPHF.
- Conception et visualisation : **GGB Insight Africa**.

Les photographies sont illustratives et ne documentent pas nécessairement les 17 projets affichés.
