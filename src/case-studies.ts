/*
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Interface for a case study that contains information about the organization that wrote the study and the study itself.
 */
export interface CaseStudy {
  title: string;
  title_fr: string;
  description: string;
  description_fr: string;
  logoImgSrc: string;
  logoImgSrc2x: string;
  caseStudyHref: string;
}

/**
 * List of case studies that contains information about the organization that wrote the study and the study itself
 */
export const CASE_STUDIES: CaseStudy[] = [
  {
    title: "The Public Good Projects",
    title_fr: "The Public Good Projects",
    description: "Using Google’s Vaccine Search Insights to increase vaccine confidence among BIPOC communities",
    description_fr: "Utiliser les statistiques de recherche de Google relatives au vaccin pour augmenter la confiance dans les vaccins parmi les communautés PANDC",
    logoImgSrc: 'https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/pdf/vsi-3p-logos/PGP_64px.png',
    logoImgSrc2x: 'https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/pdf/vsi-3p-logos/PGP_128px.png',
    caseStudyHref: 'https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/pdf/The%20Public%20Good%20Projects%20Case%20Study.pdf',
  },
  {
    title: "Grapevine Health",
    title_fr: "Grapevine Health",
    description: "Augmenting intelligence about high yield locations for vaccination outreach",
    description_fr: "Améliorer les renseignements sur les lieux à potentiel élevé pour la sensibilisation à la vaccination",
    logoImgSrc: 'https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/pdf/vsi-3p-logos/GrapevineHealth_64px.png',
    logoImgSrc2x: 'https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/pdf/vsi-3p-logos/GrapevineHealth_128px.png',
    caseStudyHref: 'https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/pdf/Grapevine%20Health%20Case%20Study.pdf',
  },
];