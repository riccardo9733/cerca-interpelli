# Direttive di Sicurezza Obbligatorie

1. **Divieto di Cancellazione Dati**: Non eseguire mai comandi SQL distruttivi (`DELETE`, `TRUNCATE`, `DROP`) o azioni di reset senza previa ed esplicita autorizzazione dell'utente.
2. **Divieto di Chiamate API a Pagamento**: Non invocare mai Edge Functions, script di sincronizzazione o API esterne che consumano token o risorse a pagamento (OpenRouter, OpenAI, ecc.) senza che l'utente l'abbia ordinato esplicitamente.
3. **Pianificazione ed Esecuzione**: Limitati a modificare i file di codice locali e proponi le azioni di rete/database lasciando all'utente la scelta se ed quando lanciarle.
