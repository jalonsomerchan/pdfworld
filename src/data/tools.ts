import type { Lang } from '../i18n/ui';

export type ToolStatus = 'available' | 'soon' | 'beta';
export type ToolCategoryId = 'organizar' | 'convertir' | 'optimizar' | 'seguridad' | 'edicion' | 'utilidad';

type LocalizedText = Record<Lang, string>;

export interface PdfToolCategory {
  id: ToolCategoryId;
  title: LocalizedText;
  description: LocalizedText;
  icon: string;
  seo: {
    title: LocalizedText;
    description: LocalizedText;
  };
}

export interface PdfTool {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  category: ToolCategoryId;
  route: string;
  icon: string;
  status: ToolStatus;
  keywords: string[];
  seo: {
    title: LocalizedText;
    description: LocalizedText;
  };
}

export const toolStatusLabels: Record<ToolStatus, LocalizedText> = {
  available: { es: 'Disponible', en: 'Available' },
  soon: { es: 'Próximamente', en: 'Soon' },
  beta: { es: 'Beta', en: 'Beta' },
};

export const pdfToolCategories = [
  {
    id: 'organizar',
    title: { es: 'Organizar PDF', en: 'Organize PDF' },
    description: {
      es: 'Une, divide, rota y reordena documentos PDF sin subirlos a ningún servidor.',
      en: 'Merge, split, rotate and reorder PDF documents without uploading them to any server.',
    },
    icon: '🗂️',
    seo: {
      title: { es: 'Herramientas para organizar PDF online y privado', en: 'Private online tools to organize PDF files' },
      description: {
        es: 'Herramientas frontend para unir, dividir, rotar y ordenar PDF directamente en tu navegador.',
        en: 'Frontend tools to merge, split, rotate and arrange PDF files directly in your browser.',
      },
    },
  },
  {
    id: 'convertir',
    title: { es: 'Convertir PDF', en: 'Convert PDF' },
    description: {
      es: 'Convierte imágenes y documentos a PDF o extrae formatos comunes desde tus archivos.',
      en: 'Convert images and documents to PDF or export common formats from your files.',
    },
    icon: '🔁',
    seo: {
      title: { es: 'Convertidores PDF online en el navegador', en: 'Browser-based online PDF converters' },
      description: {
        es: 'Convierte PDF, JPG y otros formatos con herramientas que funcionan en el frontend.',
        en: 'Convert PDF, JPG and other formats with tools that run on the frontend.',
      },
    },
  },
  {
    id: 'optimizar',
    title: { es: 'Optimizar PDF', en: 'Optimize PDF' },
    description: {
      es: 'Reduce peso, mejora archivos y prepara documentos PDF para compartirlos mejor.',
      en: 'Reduce file size, improve files and prepare PDF documents for easier sharing.',
    },
    icon: '⚡',
    seo: {
      title: { es: 'Herramientas para optimizar PDF online', en: 'Online tools to optimize PDF files' },
      description: {
        es: 'Comprime, repara y optimiza PDF desde el navegador manteniendo la privacidad.',
        en: 'Compress, repair and optimize PDF files in the browser while keeping them private.',
      },
    },
  },
  {
    id: 'seguridad',
    title: { es: 'Seguridad PDF', en: 'PDF security' },
    description: {
      es: 'Protege, desbloquea y revisa documentos PDF manteniendo el control de tus archivos.',
      en: 'Protect, unlock and review PDF documents while keeping control of your files.',
    },
    icon: '🔐',
    seo: {
      title: { es: 'Herramientas de seguridad PDF privadas', en: 'Private PDF security tools' },
      description: {
        es: 'Opciones para proteger y gestionar la seguridad de PDFs directamente en el navegador.',
        en: 'Options to protect and manage PDF security directly in the browser.',
      },
    },
  },
  {
    id: 'edicion',
    title: { es: 'Editar PDF', en: 'Edit PDF' },
    description: {
      es: 'Edita metadatos, numera páginas y prepara pequeñas modificaciones de documentos PDF.',
      en: 'Edit metadata, number pages and prepare small changes to PDF documents.',
    },
    icon: '✏️',
    seo: {
      title: { es: 'Herramientas para editar PDF en el navegador', en: 'Browser-based PDF editing tools' },
      description: {
        es: 'Edita información y detalles de tus PDFs con utilidades 100% frontend.',
        en: 'Edit information and details in your PDFs with 100% frontend utilities.',
      },
    },
  },
  {
    id: 'utilidad',
    title: { es: 'Utilidades PDF', en: 'PDF utilities' },
    description: {
      es: 'Herramientas auxiliares para revisar, limpiar y preparar archivos PDF.',
      en: 'Helper tools to review, clean and prepare PDF files.',
    },
    icon: '🧰',
    seo: {
      title: { es: 'Utilidades PDF online privadas', en: 'Private online PDF utilities' },
      description: {
        es: 'Utilidades PDF simples, privadas y ejecutadas directamente en el navegador.',
        en: 'Simple, private PDF utilities that run directly in the browser.',
      },
    },
  },
] as const satisfies PdfToolCategory[];

export const pdfTools = [
  {
    id: 'merge-pdf',
    title: { es: 'Unir PDF', en: 'Merge PDF' },
    description: { es: 'Combina varios archivos PDF en uno solo sin perder privacidad.', en: 'Combine several PDF files into a single document without losing privacy.' },
    category: 'organizar', route: 'unir-pdf', icon: '➕', status: 'available',
    keywords: ['unir pdf', 'combinar pdf', 'merge pdf', 'pdf-lib'],
    seo: {
      title: { es: 'Unir PDF online gratis y privado', en: 'Merge PDF online for free and privately' },
      description: { es: 'Une varios archivos PDF directamente en tu navegador. Gratis, privado y sin subir documentos a ningún servidor.', en: 'Merge several PDF files directly in your browser. Free, private and without uploading documents to any server.' },
    },
  },
  {
    id: 'reorder-pdf',
    title: { es: 'Ordenar PDF', en: 'Reorder PDF' },
    description: { es: 'Reordena páginas, elimina las que no necesites y descarga una copia nueva.', en: 'Reorder pages, remove the ones you do not need and download a new copy.' },
    category: 'organizar', route: 'ordenar-pdf', icon: '↕️', status: 'available',
    keywords: ['ordenar pdf', 'reordenar pdf', 'mover páginas pdf', 'reorder pdf', 'pdf-lib', 'pdf.js'],
    seo: {
      title: { es: 'Ordenar páginas PDF online gratis y privado', en: 'Reorder PDF pages online for free and privately' },
      description: { es: 'Reordena páginas de un PDF, elimina las que no necesites y descarga un nuevo documento. Todo funciona localmente en tu navegador.', en: 'Reorder PDF pages, remove pages you do not need and download a new document. Everything runs locally in your browser.' },
    },
  },
  {
    id: 'split-pdf',
    title: { es: 'Dividir PDF', en: 'Split PDF' },
    description: { es: 'Extrae páginas o rangos de un PDF y descarga un nuevo documento privado.', en: 'Extract pages or ranges from a PDF and download a new private document.' },
    category: 'organizar', route: 'dividir-pdf', icon: '✂️', status: 'available',
    keywords: ['dividir pdf', 'separar pdf', 'extraer páginas pdf', 'split pdf', 'pdf-lib'],
    seo: {
      title: { es: 'Dividir PDF online sin subir archivos', en: 'Split PDF online without uploads' },
      description: { es: 'Divide PDF por páginas o rangos desde el navegador, manteniendo los archivos en tu dispositivo.', en: 'Split PDFs by pages or ranges from the browser, keeping files on your device.' },
    },
  },
  {
    id: 'rotate-pdf',
    title: { es: 'Rotar PDF', en: 'Rotate PDF' },
    description: { es: 'Gira páginas concretas de un documento PDF antes de descargarlo corregido.', en: 'Rotate specific pages in a PDF document before downloading the corrected file.' },
    category: 'organizar', route: 'rotar-pdf', icon: '🔄', status: 'beta',
    keywords: ['rotar pdf', 'girar pdf', 'rotate pdf'],
    seo: {
      title: { es: 'Rotar PDF online en el navegador', en: 'Rotate PDF online in the browser' },
      description: { es: 'Rota páginas PDF localmente en el navegador, sin enviar documentos a servidores externos.', en: 'Rotate PDF pages locally in the browser without sending documents to external servers.' },
    },
  },
  {
    id: 'compress-pdf',
    title: { es: 'Comprimir PDF', en: 'Compress PDF' },
    description: { es: 'Reduce el tamaño de tus PDFs en el navegador con calidad configurable.', en: 'Reduce PDF size in the browser with configurable quality.' },
    category: 'optimizar', route: 'comprimir-pdf', icon: '📦', status: 'available',
    keywords: ['comprimir pdf', 'reducir pdf', 'compress pdf', 'optimizar pdf', 'pdf.js', 'pdf-lib'],
    seo: {
      title: { es: 'Comprimir PDF online privado', en: 'Compress PDF online privately' },
      description: { es: 'Comprime PDF directamente en tu navegador con una estrategia local basada en pdf.js y pdf-lib, sin subir archivos.', en: 'Compress PDFs directly in your browser with a local strategy based on pdf.js and pdf-lib, without uploads.' },
    },
  },
  {
    id: 'jpg-to-pdf',
    title: { es: 'JPG a PDF', en: 'JPG to PDF' },
    description: { es: 'Convierte imágenes JPG en un documento PDF listo para descargar.', en: 'Convert JPG images into a PDF document ready to download.' },
    category: 'convertir', route: 'jpg-a-pdf', icon: '🖼️', status: 'soon',
    keywords: ['jpg a pdf', 'imagen a pdf', 'jpg to pdf'],
    seo: {
      title: { es: 'Convertir JPG a PDF online', en: 'Convert JPG to PDF online' },
      description: { es: 'Convierte imágenes JPG a PDF directamente en el navegador y sin subir archivos.', en: 'Convert JPG images to PDF directly in the browser without uploading files.' },
    },
  },
  {
    id: 'pdf-to-jpg',
    title: { es: 'PDF a JPG', en: 'PDF to JPG' },
    description: { es: 'Extrae páginas de PDF como imágenes JPG para usarlas fácilmente.', en: 'Export PDF pages as JPG images for easy reuse.' },
    category: 'convertir', route: 'pdf-a-jpg', icon: '🧾', status: 'soon',
    keywords: ['pdf a jpg', 'convertir pdf imagen', 'pdf to jpg'],
    seo: {
      title: { es: 'Convertir PDF a JPG online', en: 'Convert PDF to JPG online' },
      description: { es: 'Convierte páginas PDF a imágenes JPG usando herramientas frontend.', en: 'Convert PDF pages to JPG images using frontend tools.' },
    },
  },
  {
    id: 'protect-pdf',
    title: { es: 'Proteger PDF', en: 'Protect PDF' },
    description: { es: 'Prepara opciones para proteger documentos PDF con contraseña.', en: 'Prepare options to protect PDF documents with a password.' },
    category: 'seguridad', route: 'proteger-pdf', icon: '🛡️', status: 'soon',
    keywords: ['proteger pdf', 'contraseña pdf', 'protect pdf'],
    seo: {
      title: { es: 'Proteger PDF online con privacidad', en: 'Protect PDF online privately' },
      description: { es: 'Herramienta planificada para proteger PDF desde el navegador.', en: 'Planned tool to protect PDF files from the browser.' },
    },
  },
  {
    id: 'unlock-pdf',
    title: { es: 'Desbloquear PDF', en: 'Unlock PDF' },
    description: { es: 'Gestiona restricciones de PDFs cuando tengas permiso para modificarlos.', en: 'Manage PDF restrictions when you have permission to modify them.' },
    category: 'seguridad', route: 'desbloquear-pdf', icon: '🔓', status: 'soon',
    keywords: ['desbloquear pdf', 'quitar contraseña pdf', 'unlock pdf'],
    seo: {
      title: { es: 'Desbloquear PDF online privado', en: 'Unlock PDF online privately' },
      description: { es: 'Utilidad planificada para gestionar restricciones de PDFs en el navegador.', en: 'Planned utility to manage PDF restrictions in the browser.' },
    },
  },
  {
    id: 'edit-metadata',
    title: { es: 'Editar metadatos PDF', en: 'Edit PDF metadata' },
    description: { es: 'Cambia título, autor y otros metadatos básicos de un PDF.', en: 'Change title, author and other basic metadata in a PDF.' },
    category: 'edicion', route: 'editar-metadatos-pdf', icon: '🏷️', status: 'soon',
    keywords: ['metadatos pdf', 'editar pdf', 'pdf metadata'],
    seo: {
      title: { es: 'Editar metadatos PDF online', en: 'Edit PDF metadata online' },
      description: { es: 'Edita metadatos básicos de documentos PDF con una herramienta frontend.', en: 'Edit basic metadata in PDF documents with a frontend tool.' },
    },
  },
  {
    id: 'page-numbers',
    title: { es: 'Numerar páginas PDF', en: 'Add PDF page numbers' },
    description: { es: 'Añade numeración visible a las páginas de tus documentos PDF.', en: 'Add visible page numbers to your PDF documents.' },
    category: 'edicion', route: 'numerar-paginas-pdf', icon: '🔢', status: 'soon',
    keywords: ['numerar pdf', 'números de página pdf', 'page numbers pdf'],
    seo: {
      title: { es: 'Numerar páginas PDF online', en: 'Add page numbers to PDF online' },
      description: { es: 'Añade números de página a documentos PDF desde el navegador.', en: 'Add page numbers to PDF documents from the browser.' },
    },
  },
  {
    id: 'repair-pdf',
    title: { es: 'Reparar PDF', en: 'Repair PDF' },
    description: { es: 'Intenta recuperar PDFs dañados o con problemas de lectura.', en: 'Try to recover damaged PDFs or files with reading issues.' },
    category: 'utilidad', route: 'reparar-pdf', icon: '🩹', status: 'soon',
    keywords: ['reparar pdf', 'pdf dañado', 'repair pdf'],
    seo: {
      title: { es: 'Reparar PDF online en el navegador', en: 'Repair PDF online in the browser' },
      description: { es: 'Utilidad planificada para intentar recuperar documentos PDF con problemas.', en: 'Planned utility to try to recover PDF documents with issues.' },
    },
  },
] as const satisfies PdfTool[];

export function isToolCategoryId(category: string | undefined): category is ToolCategoryId {
  return Boolean(category && pdfToolCategories.some((item) => item.id === category));
}

export function getCategoryById(category: ToolCategoryId) {
  return pdfToolCategories.find((item) => item.id === category)!;
}

export function getToolsByCategory(category: ToolCategoryId) {
  return pdfTools.filter((tool) => tool.category === category);
}

export function getCategoriesWithTools() {
  return pdfToolCategories.map((category) => ({ ...category, tools: getToolsByCategory(category.id) }));
}

export function getToolById(id: string) {
  return pdfTools.find((tool) => tool.id === id);
}
