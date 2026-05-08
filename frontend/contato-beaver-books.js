function toggleAuthorBlock(val){
  const block=document.getElementById('author-block');
  if(val==='publicar'||val==='orcamento'){
    block.classList.add('active');
  } else {
    block.classList.remove('active');
  }
}

function selectRadio(label){
  const group=label.closest('.radio-group');
  group.querySelectorAll('.radio-option').forEach(o=>o.classList.remove('selected'));
  label.classList.add('selected');
  label.querySelector('input').checked=true;
}

function toggleFaq(btn){
  const ans=btn.nextElementSibling;
  const icon=btn.querySelector('.faq-icon'); 
  const isOpen=ans.classList.contains('open');
  // close all
  document.querySelectorAll('.faq-a').forEach(a=>a.classList.remove('open'));
  document.querySelectorAll('.faq-icon').forEach(i=>i.classList.remove('open'));
  if(!isOpen){ans.classList.add('open');icon.classList.add('open')}
}

function showFileName(input){
  const div=document.getElementById('file-name');
  div.textContent=input.files[0]?'✓ '+input.files[0].name:'';
}

async function handleSubmit(e){
  const lgpd=document.getElementById('lgpd');
  if(!lgpd.checked){
    lgpd.focus();
    alert('Por favor, aceite a política de privacidade para continuar.');
    return;
  }
  // simulate submit
const btn = document.querySelector('.btn-cta');
  btn.textContent = 'Enviando…';
  btn.disabled = true;

  const dados = {
    nome:      document.querySelector('input[placeholder*="chamado"]').value,
    email:     document.querySelector('input[type="email"]').value,
    whatsapp:  document.querySelector('input[type="tel"]').value,
    cidade:    document.querySelector('input[placeholder*="SP"]').value,
    objetivo:  document.getElementById('objetivo').value,
    genero:    document.querySelector('#author-block select')?.value,
    finalizado: document.querySelector('input[name="finalizado"]:checked')?.value,
    paginas:   document.querySelector('input[type="number"]')?.value,
    mensagem:  document.querySelector('textarea').value,
  };

  try {
    const res = await fetch('http://localhost:3000/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    if (res.ok) {
      document.getElementById('contact-form').style.display = 'none';
      document.getElementById('success-msg').classList.add('show');
      window.scrollTo({top:document.getElementById('form').offsetTop-80,behavior:'smooth'});
    } else {
      throw new Error('Erro no servidor');
    }
  } catch (err) {
    alert('Erro ao enviar. Tente novamente.');
    btn.textContent = 'Enviar para análise gratuita';
    btn.disabled = false;
  }
}