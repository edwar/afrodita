import type { LegalDocs } from "./types"

export const SECURITY: LegalDocs = {
  es: {
    title: "Política de seguridad y privacidad",
    intro:
      "Aquí explicamos qué datos recopila Afrodita, para qué los usa, con quién los comparte y cómo los protege. Usamos solo lo necesario para que el servicio funcione.",
    sections: [
      {
        id: "datos",
        heading: "Qué datos tratamos",
        body: [
          {
            list: [
              "Tu cuenta: nombre, correo electrónico y contraseña (guardada solo como hash, nunca en texto plano). Si entras con Google, recibimos de Google tu nombre, correo y foto de perfil; nunca vemos tu contraseña de Google.",
              "Tu sesión: identificador de sesión, fecha de expiración, dirección IP y tipo de navegador.",
              "Tu suscripción: plan, estado, fecha del próximo cobro y consumo del mes. Los datos de pago los recibe Mercado Pago, no nosotros.",
              "Tu closet: las fotos de tus prendas y sus datos (nombre, categoría, color, material, marca y temporada).",
              "Tu foto base y los looks generados con ella.",
              "Tus pedidos al estilista: lo que pides para cada outfit y las combinaciones que te propone.",
              "Tus valoraciones: «me gusta» y «no me gusta», con los motivos que elijas, la combinación de prendas y lo que pediste entonces.",
              "El registro de las condiciones que aceptas al subir tu foto (versión y fecha) y contadores diarios de uso (fotos revisadas y looks generados). No contienen imágenes.",
              "Tu idioma, que se guarda solo en tu navegador.",
            ],
          },
        ],
      },
      {
        id: "uso",
        heading: "Para qué los usamos",
        body: [
          "Para prestarte el servicio (estilista, probador y galería de looks), revisar las fotos antes de guardarlas, aplicar límites de uso, prevenir abusos y mantener el servicio seguro.",
          "No vendemos tus datos ni los usamos para publicidad. Afrodita no entrena modelos con tu contenido.",
        ],
      },
      {
        id: "terceros",
        heading: "Con quién los compartimos",
        body: [
          "Usamos proveedores que procesan datos por nuestra cuenta:",
          {
            list: [
              "Google (inicio de sesión con Google): verifica tu identidad cuando eliges entrar con tu cuenta de Google.",
              "Google (API de Gemini): recibe tus mensajes al estilista, los datos de tus prendas y tus valoraciones recientes para recomendarte looks; tu foto base para revisarla; y tu foto base junto con las fotos de las prendas del look para generar la imagen.",
              "Mercado Pago: procesa los pagos de la suscripción; recibe tu correo y tus datos de pago.",
              "Neon: base de datos y almacenamiento privado de archivos (tus fotos y looks).",
              "Vercel: alojamiento de la aplicación.",
            ],
          },
          "Estos proveedores pueden procesar datos fuera de tu país, por ejemplo en Estados Unidos. Cada uno se rige por sus propias condiciones y políticas. También podemos comunicar datos a las autoridades cuando la ley lo exija.",
        ],
      },
      {
        id: "proteccion",
        heading: "Cómo los protegemos",
        body: [
          {
            list: [
              "Las conexiones usan HTTPS (cifrado en tránsito).",
              "Tus fotos se guardan en almacenamiento privado, sin acceso público. Tu foto base y tus looks solo se entregan a tu sesión, y las fotos de tus prendas solo a su dueño.",
              "Cada cuenta solo accede a sus propios datos; el servidor lo verifica en cada petición.",
              "Las contraseñas se guardan con hash.",
              "Tu foto base se revisa antes de guardarse; si no se puede revisar, no se guarda.",
              "Hay límites diarios de uso para reducir abusos.",
            ],
          },
          "Ningún sistema es totalmente seguro, así que no podemos garantizar una seguridad absoluta.",
        ],
      },
      {
        id: "revision",
        heading: "Revisión automática de tu foto",
        body: [
          "Antes de guardar tu foto base, un modelo de IA (Gemini) la analiza para comprobar que sales una sola persona, vestida, mayor de edad y con el cuerpo visible, y que no hay desnudez ni contenido sexual o dañino.",
          "Es una revisión automática y puede equivocarse. Si tu foto se rechaza y crees que es un error, prueba con otra. Las fotos rechazadas no se guardan y no queda registro de ellas, solo el motivo técnico del rechazo.",
        ],
      },
      {
        id: "conservacion",
        heading: "Cuánto tiempo conservamos tus datos",
        body: [
          {
            list: [
              "Tu foto base: hasta que la elimines o la reemplaces.",
              "Los looks generados: hasta que elimines cada look. Eliminar tu foto base no los borra.",
              "Tus prendas: hasta que las elimines.",
              "Los datos de tu cuenta y tus valoraciones: mientras tengas la cuenta. Si eliminas un look que descartaste, conservamos esa valoración para no volver a proponértelo.",
            ],
          },
          "Los proveedores pueden conservar copias de seguridad durante un tiempo limitado después de que elimines los datos.",
        ],
      },
      {
        id: "derechos",
        heading: "Tus derechos y cómo ejercerlos",
        body: [
          "Puedes acceder a tus datos, corregirlos y eliminarlos. Desde la aplicación puedes editar o eliminar tus prendas, eliminar tu foto base y eliminar looks.",
          "Para eliminar tu cuenta con todos tus datos y archivos, o para ejercer otros derechos (acceso, rectificación, oposición o retirar tu consentimiento), contáctanos. Si crees que tus datos se tratan indebidamente, puedes acudir a la autoridad de protección de datos de tu país.",
        ],
      },
      {
        id: "menores",
        heading: "Menores de edad",
        body: [
          "Afrodita es solo para mayores de 18 años. Si detectamos o sabemos que un menor usa el servicio, podemos rechazar sus fotos, cerrar la cuenta y eliminar sus datos.",
        ],
      },
      {
        id: "reportes",
        heading: "Contenido prohibido y reportes",
        body: [
          "Si ves contenido que incumple nuestras reglas, o crees que una foto tuya se usó sin tu permiso, avísanos. Lo revisaremos y podremos eliminarlo y suspender cuentas.",
        ],
      },
      {
        id: "cookies",
        heading: "Cookies y almacenamiento local",
        body: [
          "Usamos una cookie de sesión, necesaria para mantenerte conectado, y guardamos tu idioma en el navegador. No usamos cookies de publicidad ni de seguimiento.",
        ],
      },
      {
        id: "incidentes",
        heading: "Incidentes de seguridad",
        body: [
          "Si ocurre un incidente que afecte tus datos, te lo comunicaremos, y también a las autoridades cuando la ley lo exija.",
        ],
      },
      {
        id: "cambios",
        heading: "Cambios en esta política",
        body: [
          "Podemos actualizar esta política. La fecha de arriba indica la última versión; si el cambio es importante, te avisaremos.",
        ],
      },
    ],
  },
  en: {
    title: "Security and privacy policy",
    intro:
      "Here we explain what data Afrodita collects, what it uses it for, who it shares it with and how it protects it. We use only what is needed for the service to work.",
    sections: [
      {
        id: "data",
        heading: "What data we process",
        body: [
          {
            list: [
              "Your account: name, email address and password (stored only as a hash, never in plain text). If you sign in with Google, we receive your name, email and profile picture from Google; we never see your Google password.",
              "Your session: session identifier, expiry date, IP address and browser type.",
              "Your subscription: plan, status, next charge date and this month's usage. Payment details go to Mercado Pago, not to us.",
              "Your closet: the photos of your garments and their details (name, category, color, material, brand and season).",
              "Your base photo and the looks generated from it.",
              "Your requests to the stylist: what you ask for in each outfit and the combinations it proposes.",
              "Your ratings: likes and dislikes, with the reasons you choose, the combination of garments and what you asked for at the time.",
              "The record of the conditions you accept when uploading your photo (version and date) and daily usage counters (photos reviewed and looks generated). They contain no images.",
              "Your language, which is stored only in your browser.",
            ],
          },
        ],
      },
      {
        id: "use",
        heading: "What we use it for",
        body: [
          "To provide the service (stylist, try-on and looks gallery), review photos before saving them, apply usage limits, prevent abuse and keep the service secure.",
          "We do not sell your data or use it for advertising. Afrodita does not train models on your content.",
        ],
      },
      {
        id: "third-parties",
        heading: "Who we share it with",
        body: [
          "We use providers that process data on our behalf:",
          {
            list: [
              "Google (Sign in with Google): verifies your identity when you choose to sign in with your Google account.",
              "Google (Gemini API): receives your messages to the stylist, your garments' details and your recent ratings to recommend looks; your base photo to review it; and your base photo together with the photos of the garments in a look to generate the image.",
              "Mercado Pago: processes subscription payments; receives your email and payment details.",
              "Neon: database and private file storage (your photos and looks).",
              "Vercel: application hosting.",
            ],
          },
          "These providers may process data outside your country, for example in the United States. Each one is governed by its own terms and policies. We may also disclose data to authorities when the law requires it.",
        ],
      },
      {
        id: "protection",
        heading: "How we protect it",
        body: [
          {
            list: [
              "Connections use HTTPS (encryption in transit).",
              "Your photos are kept in private storage with no public access. Your base photo and your looks are delivered only to your session, and your garment photos only to their owner.",
              "Each account can only access its own data; the server checks this on every request.",
              "Passwords are stored as hashes.",
              "Your base photo is reviewed before it is saved; if it cannot be reviewed, it is not saved.",
              "There are daily usage limits to reduce abuse.",
            ],
          },
          "No system is completely secure, so we cannot guarantee absolute security.",
        ],
      },
      {
        id: "review",
        heading: "Automated review of your photo",
        body: [
          "Before saving your base photo, an AI model (Gemini) analyzes it to check that it shows one person, clothed, an adult, with the body visible, and that there is no nudity or sexual or harmful content.",
          "This is an automated review and it can be wrong. If your photo is rejected and you think that is a mistake, try another one. Rejected photos are not saved and no record of them is kept, only the technical reason for the rejection.",
        ],
      },
      {
        id: "retention",
        heading: "How long we keep your data",
        body: [
          {
            list: [
              "Your base photo: until you delete or replace it.",
              "Generated looks: until you delete each look. Deleting your base photo does not delete them.",
              "Your garments: until you delete them.",
              "Your account data and ratings: for as long as you have the account. If you delete a look you disliked, we keep that rating so it is not proposed to you again.",
            ],
          },
          "Providers may keep backups for a limited time after you delete data.",
        ],
      },
      {
        id: "rights",
        heading: "Your rights and how to exercise them",
        body: [
          "You can access, correct and delete your data. From the app you can edit or delete your garments, delete your base photo and delete looks.",
          "To delete your account with all your data and files, or to exercise other rights (access, rectification, objection or withdrawing your consent), contact us. If you believe your data is being handled improperly, you can go to the data protection authority in your country.",
        ],
      },
      {
        id: "minors",
        heading: "Minors",
        body: [
          "Afrodita is for people over 18 only. If we detect or learn that a minor is using the service, we may reject their photos, close the account and delete their data.",
        ],
      },
      {
        id: "reports",
        heading: "Prohibited content and reports",
        body: [
          "If you see content that breaks our rules, or you believe a photo of you was used without your permission, let us know. We will review it and may remove it and suspend accounts.",
        ],
      },
      {
        id: "cookies",
        heading: "Cookies and local storage",
        body: [
          "We use a session cookie, which is necessary to keep you signed in, and we store your language in your browser. We do not use advertising or tracking cookies.",
        ],
      },
      {
        id: "incidents",
        heading: "Security incidents",
        body: [
          "If an incident affects your data, we will tell you, and the authorities too when the law requires it.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to this policy",
        body: [
          "We may update this policy. The date above shows the latest version; if a change is important, we will let you know.",
        ],
      },
    ],
  },
}
