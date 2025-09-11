// Single-file image → PDF converter
(function(){
  const { jsPDF } = window.jspdf;
  const fileInput = document.getElementById('fileInput');
  const pickBtn = document.getElementById('pickBtn');
  const dropArea = document.getElementById('dropArea');
  const thumbs = document.getElementById('thumbs');
  const status = document.getElementById('status');
  const convertBtn = document.getElementById('convertBtn');
  const clearBtn = document.getElementById('clearBtn');
  const sizeSelect = document.getElementById('sizeSelect');
  const qualitySelect = document.getElementById('qualitySelect');

  let files = [];

  function updateStatus(){
    if(!files.length) return status.textContent = 'No images selected.';
    status.textContent = files.length + ' image(s) ready — reorder thumbnails if you like.';
  }

  function addFiles(list){
    const arr = Array.from(list).filter(f=>f.type.startsWith('image/'));
    if(!arr.length) return;
    files = files.concat(arr);
    renderThumbs();
  }

  fileInput.addEventListener('change', e=> addFiles(e.target.files));

  // Drag & drop behaviour
  ['dragenter','dragover'].forEach(ev=> dropArea.addEventListener(ev, e=>{
    e.preventDefault();e.stopPropagation();dropArea.classList.add('drag')
  }));
  ['dragleave','drop'].forEach(ev=> dropArea.addEventListener(ev, e=>{
    e.preventDefault();e.stopPropagation();dropArea.classList.remove('drag')
  }));
  dropArea.addEventListener('drop', e=>{ if(e.dataTransfer) addFiles(e.dataTransfer.files); });
  dropArea.addEventListener('click', ()=> fileInput.click());

  // Render thumbnails (with drag reorder + delete on dblclick)
  function renderThumbs(){
    thumbs.innerHTML = '';
    files.forEach((file, idx)=>{
      const el = document.createElement('div'); 
      el.className = 'thumb'; 
      el.draggable = true; 
      el.dataset.index = idx;

      const img = document.createElement('img');
      const reader = new FileReader();
      reader.onload = ev=> img.src = ev.target.result;
      reader.readAsDataURL(file);
      el.appendChild(img);

      // delete on double-click
      el.addEventListener('dblclick', ()=>{ files.splice(idx,1); renderThumbs(); updateStatus(); });

      // drag reorder
      el.addEventListener('dragstart', e=> e.dataTransfer.setData('text/plain', idx));
      el.addEventListener('dragover', e=> e.preventDefault());
      el.addEventListener('drop', e=>{
        const from = Number(e.dataTransfer.getData('text/plain'));
        const to = Number(el.dataset.index);
        if(isNaN(from) || isNaN(to)) return;
        const item = files.splice(from,1)[0];
        files.splice(to,0,item);
        renderThumbs(); updateStatus();
      });

      thumbs.appendChild(el);
    });
    updateStatus();
  }

  clearBtn.addEventListener('click', ()=>{
    files = []; renderThumbs(); updateStatus(); fileInput.value = '';
  });

  // Convert to PDF
  convertBtn.addEventListener('click', async ()=>{
    if(!files.length) return alert('No images selected.');
    convertBtn.disabled = true; convertBtn.textContent = 'Converting...';

    const paper = sizeSelect.value;
    const quality = parseFloat(qualitySelect.value) || 0.92;

    const sizes = { a4:{w:210,h:297}, letter:{w:216,h:279} };
    const mm = sizes[paper] || sizes.a4;

    const pdf = new jsPDF({unit:'mm',format:[mm.w,mm.h]});

    for(let i=0;i<files.length;i++){
      const file = files[i];
      try{
        const imgData = await fileToImageDataURL(file, quality);
        const img = await loadImage(imgData);
        const { canvas, wPx, hPx } = fitToCanvas(img, mm.w, mm.h);
        const finalData = canvas.toDataURL('image/jpeg', quality);

        const ratio = Math.min(mm.w / (wPx*0.264583), mm.h / (hPx*0.264583));
        const drawW = (wPx * 0.264583) * ratio;
        const drawH = (hPx * 0.264583) * ratio;
        const x = (mm.w - drawW)/2;
        const y = (mm.h - drawH)/2;

        if(i>0) pdf.addPage();
        pdf.addImage(finalData, 'JPEG', x, y, drawW, drawH);
      }catch(err){
        console.error('failed to add image',err);
      }
    }

    const filename = 'images-to-pdf_' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'-') + '.pdf';
    pdf.save(filename);
    convertBtn.disabled = false; convertBtn.textContent = 'Convert to PDF';
  });

  // helpers
  function fileToImageDataURL(file){
    return new Promise((res,rej)=>{
      const reader = new FileReader();
      reader.onload = e=> res(e.target.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  }
  function loadImage(dataURL){
    return new Promise((res,rej)=>{
      const img = new Image();
      img.onload = ()=> res(img);
      img.onerror = rej;
      img.src = dataURL;
    });
  }
  function fitToCanvas(img, paperWmm, paperHmm){
    const DPI = 150;
    const pxPerMm = DPI / 25.4;
    const canvasW = Math.round(paperWmm * pxPerMm);
    const canvasH = Math.round(paperHmm * pxPerMm);

    const imgRatio = img.width / img.height;
    const areaRatio = canvasW / canvasH;
    let drawWpx, drawHpx;
    if(imgRatio > areaRatio){
      drawWpx = Math.min(img.width, canvasW);
      drawHpx = Math.round(drawWpx / imgRatio);
    } else {
      drawHpx = Math.min(img.height, canvasH);
      drawWpx = Math.round(drawHpx * imgRatio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = drawWpx;
    canvas.height = drawHpx;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, drawWpx, drawHpx);
    return { canvas, wPx: drawWpx, hPx: drawHpx };
  }
})();