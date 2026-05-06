import {type EntityId} from 'wikibase-sdk';
import { getImageUrl } from 'wikibase-sdk';
import { getEntities } from './helper';

const params = new URLSearchParams(window.location.search);
const id: EntityId = (params.get('id') || 'Q2502233') as EntityId;
document.getElementById('labelLink')!.setAttribute('href', `https://www.wikidata.org/wiki/${id}`);

const propertyData: {[key: string]: any} = {};
const itemData: {[key: string]: any} = {};

// Fetch property data
getEntities(['P21', 'P106', 'P569', 'P570', 'P1416']).then(data => {
    propertyData['P21'] = data['P21'].labels;
    propertyData['P106'] = data['P106'].labels;
    propertyData['P569'] = data['P569'].labels;
    propertyData['P570'] = data['P570'].labels;
    propertyData['P1416'] = data['P1416'].labels;

    document.getElementById('genderLabel')!.textContent = `${propertyData['P21']['en'] || 'P21'}: `;
    document.getElementById('dateOfBirthLabel')!.textContent = `${propertyData['P569']['en'] || 'P569'}: `;
    document.getElementById('dateOfDeathLabel')!.textContent = `${propertyData['P570']['en'] || 'P570'}: `;
    document.getElementById('occupationLabel')!.textContent = `${propertyData['P106']['en'] || 'P106'}: `;
    document.getElementById('affiliationLabel')!.textContent = `${propertyData['P1416']['en'] || 'P1416'}: `;
});

// Fetch item data and related entities
getEntities([id]).then(data => {
    let entity = data[id];
    console.log(entity);
    itemData["label"] = entity.labels;
    const imageUrl = entity.claims?.P18?.[0] ? getImageUrl((entity.claims?.P18?.[0]) as string) : '';
    const description = entity.descriptions?.['en'] || '';
    itemData["description"] = entity.descriptions;
    const genders = entity.claims?.P21?.map((g: any) => g as string) || [];
    const occupations = entity.claims?.P106?.map((o: any) => o as string) || [];
    const label = entity.labels?.['en'] || '';
    const languages = Object.keys(entity.labels || {});
    const dateOfBirth = entity.claims?.P569?.[0] as string || '';
    const dateOfDeath = entity.claims?.P570?.[0] as string || '';
    const affiliations = entity.claims?.P1416?.map((a: any) => a as string) || [];

    getEntities([ ...genders, ...occupations, ...affiliations ], ['labels']).then(entities => {
        const gendersLabels = genders.map((g) => entities[g]);
        const gendersLabelsArray = gendersLabels.map((g: any) => g.labels || '');
        itemData["genders"] = gendersLabelsArray;

        const occupationsLabels = occupations.map((o) => entities[o]);
        const occupationsLabelsArray = occupationsLabels.map((o: any) => o.labels || '');
        itemData["occupations"] = occupationsLabelsArray;

        const affiliationsLabels = affiliations.map((a) => entities[a]);
        const affiliationsLabelsArray = affiliationsLabels.map((a: any) => a.labels || '');
        itemData["affiliations"] = affiliationsLabelsArray;

        document.getElementById('label')!.innerHTML = `${label}`;
        document.getElementById('image')!.setAttribute('src', imageUrl);
        if (imageUrl && imageUrl !== '') {
            document.getElementById('image')!.removeAttribute('hidden');
        }
        document.getElementById('description')!.textContent = description;
        document.getElementById('gender')!.textContent = `${gendersLabelsArray.map((g) => g?.['en'] || '').join(', ')}`;
        document.getElementById('dateOfBirth')!.textContent = `${dateOfBirth}`;
        document.getElementById('dateOfDeath')!.textContent = `${dateOfDeath}`;
        if (dateOfDeath && dateOfDeath !== '') {
            document.getElementById('dateOfDeathLabel')!.removeAttribute('hidden');
        }
        document.getElementById('occupation')!.textContent = `${occupationsLabelsArray.map((o) => o?.['en'] || '').join(', ')}`;
        document.getElementById('affiliation')!.textContent = `${affiliationsLabelsArray.map((a) => a?.['en'] || '').join(', ')}`;
        if (affiliationsLabelsArray.length > 0) {
            document.getElementById('affiliationLabel')!.removeAttribute('hidden');
        }
        const languageSelect = document.querySelector<HTMLSelectElement>('#language')!;
        languages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = lang;
            if (lang === 'en') {
                option.selected = true;
            }
            languageSelect.add(option);
        });
    });
});

document.querySelector<HTMLSelectElement>('#language')!.addEventListener('change', function() {
    document.getElementById('label')!.textContent = itemData["label"]?.[this.value] || itemData["label"]?.["en"] || '';
    document.getElementById('description')!.textContent = itemData["description"]?.[this.value] || itemData["description"]?.["en"] || '';
    const gendersLabelsArray = itemData["genders"].map((g: any) => g[this.value] || g['en'] || '');
    console.log(itemData["genders"])
    document.getElementById('gender')!.textContent = gendersLabelsArray.join(', ');
    const occupationsLabelsArray = itemData["occupations"].map((o: any) => o[this.value] || o['en'] || '');
    document.getElementById('occupation')!.textContent = occupationsLabelsArray.join(', ');

    document.getElementById('genderLabel')!.textContent = `${propertyData['P21']?.[this.value] || propertyData['P21']?.["en"] || 'P21'}: `;
    document.getElementById('dateOfBirthLabel')!.textContent = `${propertyData['P569']?.[this.value] || propertyData['P569']?.["en"] || 'P569'}: `;
    document.getElementById('dateOfDeathLabel')!.textContent = `${propertyData['P570']?.[this.value] || propertyData['P570']?.["en"] || 'P570'}: `;
    document.getElementById('occupationLabel')!.textContent = `${propertyData['P106']?.[this.value] || propertyData['P106']?.["en"] || 'P106'}: `;
});
