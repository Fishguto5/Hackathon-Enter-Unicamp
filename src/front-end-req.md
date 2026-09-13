# Contexto do problema
A Enter é uma empresa de Enterprise AI, a maior empresa nativa de IA do país e atualmente focada em soluções para processos jurídicos cíveis massificados — aqueles casos repetitivos em que pessoas físicas processam grandes empresas (ex: um consumidor processa uma companhia aérea por atraso de voo).

Nosso produto principal é o EnterOS, um modelo de operação jurídico onde uma empresa pode centralizar a operação de todos os seus escritórios de advocacia, aprimorando a qualidade das peças jurídicas e produtividade dos advogados. O EnterOS é construído sobre agentes de IA que automatizam e agregam inteligência a todas as etapas de um processo judicial — do recebimento da ação até o encerramento do caso.

O Banco Unicamp recebe, em média, ~15 mil novos processos por mês. Desses, cerca de ~5 mil envolvem um cenário específico: a pessoa que está processando o banco alega que não reconhece a contratação de um empréstimo. Na prática, ela diz que está sofrendo descontos em sua conta bancária referentes ao pagamento de um empréstimo que nunca contratou.

Diante de cada processo, o Banco precisa tomar uma decisão estratégica: defender-se no judiciário ou propor um acordo. Propor um acordo significa oferecer uma indenização para encerrar o caso rapidamente, evitando o risco de uma condenação judicial (que pode custar mais).

Essa decisão é regida por uma política de acordos — um conjunto de regras que define quando vale a pena fazer acordo e quanto oferecer. Hoje, o fluxo funciona assim:

    Um advogado externo (vinculado a um escritório, não funcionário do banco) recebe o processo pela plataforma da Enter.
    Na plataforma, ele tem acesso aos Autos (documentos do processo, como petição inicial e procuração) e aos Subsídios (documentos de defesa fornecidos pelo banco, como o extrato bancário, contrato, comprovante de crédito, etc.).
    Com base nesses documentos e na política do banco, o advogado decide: defesa ou acordo?
    Se optar por acordo, ele mesmo entra em contato com a parte autora para negociar.
    Após a decisão, o advogado reporta à empresa: se optou por acordo ou defesa; em caso de acordo, qual foi o valor proposto; e qual foi o resultado da negociação (acordo aceito, recusado, contraproposta, etc.).

O desafio é triplo: definir uma boa política de acordos, garantir que os advogados a sigam de forma consistente e monitorar continuamente os resultados para avaliar se a política está sendo efetiva.

# Tecnologias Usadas
## Frameworks e Bibliotecas
As tecnologias utilzadas para o funcionamento do frontend são:
- Vite.js com typescript
- React (.jsx)
- ESLint

# Funcionalidades
## Tela de login
1 - Duas opções de login, uma sendo como advogado e outra como funcionário da empresa, logo abaixo deve ter uma opção de inserir o email e em seguida a senha, por fim o botão para fazer a autenticação
2 - Não deve ser implementado nenhuma funcionalidade ligada ao backend para fazer a autenticação neste momento, apenas a parte visual
3 - A tela de login deve focar na funcionalidade do login e não em mostrar os dados apresentados anteriomente
## Padrão Visual
1 - Deve seguir o padrão visual da empresa Enter
2 - Laranja: #ffae35
3 - Fundo de tela: #ffffff
4 - Textos: Cor: #5f5f5f e Fonte: "Notoserif Subset",Tahoma,sans-serif;
 