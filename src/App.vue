<script>
export default {
  onLaunch() {},
}
</script>

<style>
/* 全局牌桌主题：深空蓝 + 青色回声点缀 + 象牙牌面 */
page,
body {
  background-color: #101728;
  color: #eef2ff;
  font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  -webkit-font-smoothing: antialiased;
  color-scheme: light only;
}

/* 通用按钮 */
.btn-primary {
  background: linear-gradient(180deg, #2fb9c9, #1b8fa3);
  color: #fff;
  border-radius: 24rpx;
  font-size: 32rpx;
  padding: 18rpx 64rpx;
  border: none;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.4);
}
.btn-primary[disabled] {
  opacity: 0.5;
}
.btn-secondary {
  background: #2a3550;
  color: #eef2ff;
  border-radius: 24rpx;
  font-size: 32rpx;
  padding: 18rpx 64rpx;
  border: none;
}
</style>
