/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {      colors: {
        'app-bg': '#212529',        // Cor de fundo principal
        'app-surface': '#343a40',   // Fundo de superfícies/cards
        'app-border': '#495057',     // Bordas e divisores
        'app-text': '#f8f9fa',         // Cor de texto principal
        'app-text-secondary': '#adb5bd', // Texto secundário/ícones
        'app-primary': '#60a5fa',     // Cor interativa primária
        'app-primary-darker': '#1279F8', // Tom mais escuro para hover/estados ativos
      },fontFamily: {
        'montserrat': ['Montserrat', 'sans-serif'],
        'quintessential': ['Quintessential', 'serif'],
      },
      aspectRatio: {
        'card': '3/4.5',
      },
      animation: {
        'logo-spin': 'spin 20s linear infinite',
        'modal-show': 'modal-show 0.3s ease-out forwards',
      },
      keyframes: {
        'modal-show': {
          '0%': {
            opacity: '0',
            transform: 'scale(0.95)'
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)'
          }
        }
      }
    },
  },
  plugins: [
    function({ addUtilities }) {
      const newUtilities = {
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          'scrollbar-color': 'rgba(248, 249, 250, 0.4) transparent',
          '&::-webkit-scrollbar': {
            width: '6px',
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(248, 249, 250, 0.4)',
            'border-radius': '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
        },
        '.chat-scrollbar': {
          'scrollbar-width': 'thin',
          'scrollbar-color': 'rgba(139, 92, 246, 0.6) rgba(55, 65, 81, 0.3)',
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(55, 65, 81, 0.3)',
            'border-radius': '3px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(139, 92, 246, 0.6)',
            'border-radius': '3px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(139, 92, 246, 0.8)',
          },
        },
        '.hide-scrollbar': {
          'scrollbar-width': 'none',
          '-ms-overflow-style': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
            width: '0',
          },
        },
        '.scrollbar-modern': {
          'scrollbar-width': 'auto',
          'scrollbar-color': '#495057 #212529',
          '&::-webkit-scrollbar': {
            width: '8px'
          },
          '&::-webkit-scrollbar-track': {
            background: '#212529'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#495057',
            borderRadius: '10px',
            border: '2px solid #212529'
          }
        }
      }
      addUtilities(newUtilities);
    }
  ],
};
