import 'server-only';
import twilio from 'twilio';
/** Omitting fields is deliberate: Basic Lookup is free; no paid intelligence package. */
export async function lookupConnectionNumber(number:string):Promise<'checked'|'unavailable'|'invalid'>{
 const sid=process.env.TWILIO_ACCOUNT_SID?.trim(),token=process.env.TWILIO_AUTH_TOKEN?.trim();
 if(!sid||!token)return 'unavailable';
 try {
  const result=await twilio(sid,token,{timeout:5000,maxRetries:0}).lookups.v2.phoneNumbers(number).fetch();
  if(result.valid===false)return 'invalid';
  if(result.valid!==true||result.countryCode!=='IE'||result.phoneNumber!==number)return 'unavailable';
  return 'checked';
 }catch{return 'unavailable';}
}
