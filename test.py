import yfinance as yf
import ssl
import streamlit as st

ssl._create_default_https_context = ssl._create_unverified_context

st.title("📈 삼성전자 가격 데이터 테스트")

name = '005930.KS'
ticker = yf.Ticker(name)
df = ticker.history(interval='1d', period='5y', auto_adjust=False)

st.write("최근 5일 종가:")
st.dataframe(df.tail())