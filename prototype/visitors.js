const looks = {
  'Ника': {coat:'#678f7d',bag:'#dd9c58',skin:'#d7a57f'},
  'Лев': {coat:'#8b999c',bag:'#b99367',skin:'#ba8667'},
  'Марат': {coat:'#b47e57',bag:'#87a698',skin:'#b58264'},
  'Борис': {coat:'#76849b',bag:'#d4a45e',skin:'#d6b08b'},
  'Ася': {coat:'#9b827d',bag:'#92ac81',skin:'#deb99a'},
  'Тим': {coat:'#8a9870',bag:'#c98c55',skin:'#bd9379'}
};
export function visitorLook(name) { return looks[name] || looks['Ника']; }
export function offerDialogue(offer) {
  const hello=offer.storyStep>1?'Снова здравствуйте! Помните меня? Хочу подготовить самокат к новому маршруту.':'Здравствуйте! Вы занимаетесь ремонтом курьерского транспорта?';
  return [
    {text:hello,reply:'Здравствуйте! Что случилось?'},
    {text:offer.complaint,reply:'Давайте обсудим условия.'},
    {text:`За работу — ${offer.payment} кредитов. Заберу до вечера дня ${offer.dueDay}. Нужно качество не ниже ${offer.minQuality}. Возьмётесь?`}
  ];
}
export function resultDialogue(job) {
  return job.passed
    ? `Спасибо! Всё как договаривались. Вот ваши ${job.payment} кредитов — я снова на маршрут.`
    : `Я не могу принять эту работу: ${job.reasons.join('; ')}. Платить за такой результат не буду.`;
}

export function personArt(look,mechanic=false) {
  const coat=mechanic?'#819779':look.coat, skin=mechanic?'#cfab86':look.skin;
  return `<svg class="person-art" viewBox="0 0 180 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="91" cy="347" rx="66" ry="10" fill="#354a3c" opacity=".2"/>
  ${!mechanic?`<path d="M119 118h37l10 124h-41z" fill="${look.bag}" stroke="#3c5143" stroke-width="6"/><path d="m133 136 20 2m-17 27 20 2m-15 28 18 1" stroke="#e6d5aa" stroke-width="4"/>`:''}
  <g class="person-leg leg-left"><path d="m57 231 29 1-7 93H55z" fill="#3e534a"/><path d="M53 317h29v20H40c-4-8 4-16 13-20" fill="#253d34"/></g>
  <g class="person-leg leg-right"><path d="m91 232 29-1 9 93h-25z" fill="#4e6253"/><path d="M103 317h28l16 14v8h-44z" fill="#2c4539"/></g>
  <path d="M55 121q30-16 58 0l15 116q-39 16-82 0z" fill="${coat}" stroke="#3d5545" stroke-width="6"/>
  <path d="M83 119v112" stroke="#d1d9b9" stroke-width="5"/><path d="M52 190h68" stroke="#b7c8a1" stroke-width="8"/>
  ${mechanic?'<path d="M65 145h38l12 94H54z" fill="#c5ae78"/><path d="M71 184h26v24H71z" fill="#8e936b"/><path d="M65 143 73 119m29 24-7-24" stroke="#c5ae78" stroke-width="7"/>':'<path d="M48 130h16l61 96-12 10z" fill="#d8be80"/><rect x="91" y="210" width="23" height="20" rx="3" fill="#6f7c58"/>'}
  <path d="M54 131q-27 12-28 69l19 1 20-57" fill="${coat}" stroke="#3d5545" stroke-width="6"/><path d="M25 197h22l-2 28q-13 14-21-1z" fill="${skin}"/>
  <path d="M112 132q28 13 32 68l-20 6-23-61" fill="${coat}" stroke="#3d5545" stroke-width="6"/><path d="m123 199 23-2 6 21q-3 21-20 11z" fill="${skin}"/>
  <path d="M73 97h24v27H73z" fill="${skin}"/>
  <path d="M54 58q3-42 46-30 32 14 13 65-17 30-48 8z" fill="${skin}" stroke="#4b5b43" stroke-width="5"/>
  ${mechanic?'<path d="M49 56q-4-36 39-36 29 1 34 27l14 12H49z" fill="#446450"/><path d="M48 58h77" stroke="#c0b77f" stroke-width="5"/>':'<path d="M48 63Q37 13 83 12q47-2 43 54l-23-11-48 11z" fill="#d4dcc1" stroke="#48624e" stroke-width="6"/><path d="M77 17v35" stroke="#88a08a" stroke-width="6"/><path d="M54 67v19m65-20-9 27" stroke="#48624e" stroke-width="5"/>'}
  <path d="M76 77h3m23-1h3" stroke="#354b3b" stroke-width="5" stroke-linecap="round"/><path d="m87 92 12-1" stroke="#8b674d" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}
