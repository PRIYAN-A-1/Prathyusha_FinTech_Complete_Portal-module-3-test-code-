import pg from 'pg';
pg.types.setTypeParser(1082,value=>value); // Calendar dates must not shift with server timezone.
export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000,statement_timeout:10000});
export async function transaction(fn){const c=await pool.connect();try{await c.query('BEGIN');const value=await fn(c);await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
export async function audit(c,user,action,target){await c.query('INSERT INTO audit_logs(actor_id,action,target_id) VALUES($1,$2,$3)',[user,action,target]);}
