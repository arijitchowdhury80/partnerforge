-- Rename old tables to preserve data before applying new schema
ALTER TABLE IF EXISTS companies RENAME TO companies_old;
ALTER TABLE IF EXISTS company_technologies RENAME TO company_technologies_old;

-- Note: technologies table is left alone (not used by new schema)
